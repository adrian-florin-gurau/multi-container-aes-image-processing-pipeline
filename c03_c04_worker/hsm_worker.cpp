#include <cstdint>
#include <mpi.h>
#include <omp.h>
#include <iostream>
#include <vector>
#include <fstream>
#include <string>
#include <cstring>
#include <algorithm>
#include <openssl/evp.h>
#include <map>

#pragma pack(push, 1)
struct BMPHeader {
    std::uint16_t type;
    std::uint32_t size;
    std::uint16_t reserved1, reserved2;
    std::uint32_t offset;
};
#pragma pack(pop)

const EVP_CIPHER* get_cipher(const std::string& mode, size_t key_len_bytes) {
    if (mode == "ECB") {
        if (key_len_bytes == 32) return EVP_aes_256_ecb();
        if (key_len_bytes == 24) return EVP_aes_192_ecb();
        return EVP_aes_128_ecb();
    }
    if (mode == "CBC") {
        if (key_len_bytes == 32) return EVP_aes_256_cbc();
        if (key_len_bytes == 24) return EVP_aes_192_cbc();
        return EVP_aes_128_cbc();
    }
    if (mode == "CTR") {
        if (key_len_bytes == 32) return EVP_aes_256_ctr();
        if (key_len_bytes == 24) return EVP_aes_192_ctr();
        return EVP_aes_128_ctr();
    }
    if (mode == "CFB") {
        if (key_len_bytes == 32) return EVP_aes_256_cfb128();
        if (key_len_bytes == 24) return EVP_aes_192_cfb128();
        return EVP_aes_128_cfb128();
    }
    if (mode == "OFB") {
        if (key_len_bytes == 32) return EVP_aes_256_ofb();
        if (key_len_bytes == 24) return EVP_aes_192_ofb();
        return EVP_aes_128_ofb();
    }
    if (mode == "GCM") {
        if (key_len_bytes == 32) return EVP_aes_256_gcm();
        if (key_len_bytes == 24) return EVP_aes_192_gcm();
        return EVP_aes_128_gcm();
    }
    return EVP_aes_128_ecb();
}

void process_chunk(std::vector<uint8_t>& data, const std::string& key_str, const std::string& action, const std::string& mode, const std::string& iv_str) {
    bool isEncrypt = (action == "ENCRYPT");
    size_t key_len = (key_str.length() >= 32) ? 32 : (key_str.length() >= 24 ? 24 : 16);
    const EVP_CIPHER* cipher = get_cipher(mode, key_len);

    std::vector<unsigned char> key_buf(key_len, 0);
    memcpy(key_buf.data(), key_str.c_str(), std::min(key_len, key_str.length()));
    
    unsigned char iv[16] = {0};
    memcpy(iv, iv_str.c_str(), std::min((size_t)16, iv_str.length()));

    int total_bytes = data.size();
    int full_blocks_end = (total_bytes / 16) * 16;

    #pragma omp parallel
    {
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        if (isEncrypt) EVP_EncryptInit_ex(ctx, cipher, NULL, key_buf.data(), iv);
        else EVP_DecryptInit_ex(ctx, cipher, NULL, key_buf.data(), iv);
        EVP_CIPHER_CTX_set_padding(ctx, 0);

        #pragma omp for
        for (int i = 0; i < full_blocks_end; i += 16) {
            int outlen;
            if (isEncrypt) EVP_EncryptUpdate(ctx, &data[i], &outlen, &data[i], 16);
            else EVP_DecryptUpdate(ctx, &data[i], &outlen, &data[i], 16);
        }
        EVP_CIPHER_CTX_free(ctx);
    }

    if (total_bytes > full_blocks_end) {
        for (int i = full_blocks_end; i < total_bytes; i++) {
            data[i] ^= key_buf[(i - full_blocks_end) % key_len];
        }
    }
}

int main(int argc, char** argv) {
    MPI_Init(&argc, &argv);

    int world_size, rank;
    MPI_Comm_size(MPI_COMM_WORLD, &world_size);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);

    if (argc < 7) {
        if (rank == 0) std::cerr << "Usage: " << argv[0] << " <in.bmp> <out.bmp> <key> <action>" << std::endl;
        MPI_Finalize();
        return 1;
    }

    std::string input_path = argv[1];
    std::string output_path = argv[2];
    std::string key = argv[3];
    std::string action = argv[4];
    std::string mode = argv[5];
    std::string iv = argv[6];
    std::vector<uint8_t> pixel_data;
    std::vector<char> metadata; 
    BMPHeader header;
    int total_pixels = 0;

    if (rank == 0) {
        std::ifstream file(input_path, std::ios::binary);
        if (!file) {
            std::cerr << "Error opening input file" << std::endl;
            MPI_Abort(MPI_COMM_WORLD, 1);
        }
        
        file.read(reinterpret_cast<char*>(&header), sizeof(BMPHeader));
        
        int metadata_size = header.offset - sizeof(BMPHeader);
        metadata.resize(metadata_size);
        file.read(metadata.data(), metadata_size);

        pixel_data.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
        total_pixels = pixel_data.size();
        file.close();
    }

    MPI_Bcast(&total_pixels, 1, MPI_INT, 0, MPI_COMM_WORLD);

    std::vector<int> send_counts(world_size);
    std::vector<int> displacements(world_size);
    int offset = 0;

    for (int i = 0; i < world_size; i++) {
        send_counts[i] = total_pixels / world_size;
        if (i < (total_pixels % world_size)) {
            send_counts[i]++;
        }
        displacements[i] = offset;
        offset += send_counts[i];
    }

    std::vector<uint8_t> local_chunk(send_counts[rank]);

    MPI_Scatterv(pixel_data.data(), send_counts.data(), displacements.data(), MPI_UNSIGNED_CHAR,
                 local_chunk.data(), send_counts[rank], MPI_UNSIGNED_CHAR,
                 0, MPI_COMM_WORLD);

    process_chunk(local_chunk, key, action, mode, iv);

    std::vector<uint8_t> result_pixels_vec;
    if (rank == 0) result_pixels_vec.resize(total_pixels);

    MPI_Gatherv(local_chunk.data(), send_counts[rank], MPI_UNSIGNED_CHAR,
                result_pixels_vec.data(), send_counts.data(), displacements.data(), MPI_UNSIGNED_CHAR,
                0, MPI_COMM_WORLD);

    if (rank == 0) {
        std::ofstream out_file(output_path, std::ios::binary);
        out_file.write(reinterpret_cast<char*>(&header), sizeof(BMPHeader));
        
        out_file.write(metadata.data(), metadata.size());

        out_file.write(reinterpret_cast<char*>(result_pixels_vec.data()), result_pixels_vec.size());
        out_file.close();
    }

    MPI_Finalize();
    return 0;
}
