#include <cstdint>  // <--- CRITICAL: Adds uint8_t, uint16_t, uint32_t
#include <mpi.h>
#include <omp.h>
#include <iostream>
#include <vector>
#include <fstream>
#include <string>
#include <cstring>    // <--- Added for memcpy
#include <algorithm>  // <--- Added for std::min
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

const EVP_CIPHER* get_cipher(const std::string& mode) {
    if (mode == "ECB") return EVP_aes_128_ecb();
    if (mode == "CBC") return EVP_aes_128_cbc();
    if (mode == "CTR") return EVP_aes_128_ctr();
    if (mode == "CFB") return EVP_aes_128_cfb128();
    if (mode == "OFB") return EVP_aes_128_ofb();
    if (mode == "GCM") return EVP_aes_128_gcm();
    return EVP_aes_128_ecb(); // Default
}

void process_chunk(std::vector<uint8_t>& data, const std::string& key_str, const std::string& action, const std::string& mode) {
    bool isEncrypt = (action == "ENCRYPT");
    const EVP_CIPHER* cipher = get_cipher(mode);

    unsigned char key[16] = {0};
    memcpy(key, key_str.c_str(), std::min((size_t)16, key_str.length()));
    unsigned char iv[16] = {0}; // In production, IV should be unique per job

    // OpenMP Parallel Section
    #pragma omp parallel
    {
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        
        if (isEncrypt) {
            EVP_EncryptInit_ex(ctx, cipher, NULL, key, iv);
        } else {
            EVP_DecryptInit_ex(ctx, cipher, NULL, key, iv);
        }

        // Critical for image processing: no padding
        EVP_CIPHER_CTX_set_padding(ctx, 0);

        /* 
           Note: For CBC/CFB/OFB to work in parallel, we treat every thread's 
           assigned range as a fresh stream starting with the IV.
        */
        #pragma omp for
        for (int i = 0; i <= (int)data.size() - 16; i += 16) {
            int outlen;
            if (isEncrypt) {
                EVP_EncryptUpdate(ctx, &data[i], &outlen, &data[i], 16);
            } else {
                EVP_DecryptUpdate(ctx, &data[i], &outlen, &data[i], 16);
            }
        }
        
        EVP_CIPHER_CTX_free(ctx);
    }
}

int main(int argc, char** argv) {
    MPI_Init(&argc, &argv);

    int world_size, rank;
    MPI_Comm_size(MPI_COMM_WORLD, &world_size);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);

    if (argc < 5) {
        if (rank == 0) std::cerr << "Usage: " << argv[0] << " <in.bmp> <out.bmp> <key> <action>" << std::endl;
        MPI_Finalize();
        return 1;
    }

    std::string input_path = argv[1];
    std::string output_path = argv[2];
    std::string key = argv[3];
    std::string action = argv[4];
    std::string mode = argv[5];
    // Declare these at the top level of main so they exist for the whole function
    std::vector<uint8_t> pixel_data;
    std::vector<char> metadata; 
    BMPHeader header;
    int total_pixels = 0;

    // 2. Master Rank (0) reads the BMP
    if (rank == 0) {
        std::ifstream file(input_path, std::ios::binary);
        if (!file) {
            std::cerr << "Error opening input file" << std::endl;
            MPI_Abort(MPI_COMM_WORLD, 1);
        }
        
        file.read(reinterpret_cast<char*>(&header), sizeof(BMPHeader));
        
        int metadata_size = header.offset - sizeof(BMPHeader);
        metadata.resize(metadata_size); // Prepare the vector
        file.read(metadata.data(), metadata_size);

        pixel_data.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
        total_pixels = pixel_data.size();
        file.close();
    }

    // 3. Broadcast metadata to all MPI ranks
    MPI_Bcast(&total_pixels, 1, MPI_INT, 0, MPI_COMM_WORLD);

    int chunk_size = (total_pixels / world_size / 16) * 16;
    std::vector<uint8_t> local_chunk(chunk_size);

    // 4. MPI Scatter
    MPI_Scatter(pixel_data.data(), chunk_size, MPI_UNSIGNED_CHAR,
                local_chunk.data(), chunk_size, MPI_UNSIGNED_CHAR,
                0, MPI_COMM_WORLD);

    // 5. OpenMP Processing
    process_chunk(local_chunk, key, action, mode);

    // 6. MPI Gather
    std::vector<uint8_t> result_pixels_vec;
    if (rank == 0) result_pixels_vec.resize(total_pixels);

    MPI_Gather(local_chunk.data(), chunk_size, MPI_UNSIGNED_CHAR,
            result_pixels_vec.data(), chunk_size, MPI_UNSIGNED_CHAR,
            0, MPI_COMM_WORLD);

    // 7. Master writes the final BMP
    if (rank == 0) {
        std::ofstream out_file(output_path, std::ios::binary);
        out_file.write(reinterpret_cast<char*>(&header), sizeof(BMPHeader));
        
        // Now 'metadata' is in scope!
        out_file.write(metadata.data(), metadata.size());

        out_file.write(reinterpret_cast<char*>(result_pixels_vec.data()), result_pixels_vec.size());
        out_file.close();
    }

    MPI_Finalize();
    return 0;
}