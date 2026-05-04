import com.rabbitmq.client.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.util.Base64;

public class HsmSubscriber {
    // Infrastructure Constants
    private final static String QUEUE_NAME = "hsm_pipeline_queue";
    private final static String RMQ_HOST = "c02_broker";
    private final static String DB_URL = "jdbc:mysql://c05_storage:3306/hsm_db";
    private final static String DB_USER = "root";
    private final static String DB_PASS = "root";

    public static void main(String[] argv) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(RMQ_HOST);

        // Connection rmqConn = factory.newConnection();
        com.rabbitmq.client.Connection rmqConn = factory.newConnection();
        com.rabbitmq.client.Channel channel = rmqConn.createChannel();

        // Ensure queue is declared (durable matches C01)
        channel.queueDeclare(QUEUE_NAME, true, false, false, null);
        System.out.println(" [*] C03 Subscriber Online. Awaiting Jobs...");

        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
            String message = new String(delivery.getBody(), StandardCharsets.UTF_8);
            
            try {
                // 1. Manual JSON Parsing (No Jackson/Maven)
                String jobId = getJsonValue(message, "jobId");
                String key = getJsonValue(message, "key");
                String action = getJsonValue(message, "action");
                String mode = getJsonValue(message, "mode");
                String base64Data = getJsonValue(message, "fileBuffer");

                System.out.println(" [x] Received Job: " + jobId + " [" + action + " - " + mode + "]");

                // 2. Decode to Temporary Byte Array
                byte[] decodedBytes = Base64.getDecoder().decode(base64Data);
                
                // Note: MPI usually needs a physical file to distribute. 
                // We use a temporary file that we delete immediately after.
                String sharedPath = "/tmp/hsm/";
                File tempIn = new File(sharedPath + "tmp_in_" + jobId + ".bmp");
                File tempOut = new File(sharedPath + "tmp_out_" + jobId + ".bmp");
                
                Files.write(tempIn.toPath(), decodedBytes);

                // 3. Launch Native MPI Process (C03 & C04)
                System.out.println(" [>] Starting MPI Parallel Processing...");
                ProcessBuilder pb = new ProcessBuilder(
                    "mpirun", 
                    "--allow-run-as-root",
                    "--host", "localhost:2,c04_worker:2", // 2 slots on Master, 2 on Worker
                    "-np", "4",                           // Total 4 parallel processes
                    "/app/hsm_worker", 
                    tempIn.getAbsolutePath(), 
                    tempOut.getAbsolutePath(), 
                    key, 
                    action,
                    mode
                );
                pb.inheritIO();
                Process mpiProcess = pb.start();
                int exitCode = mpiProcess.waitFor();

                if (exitCode == 0) {
                    // 4. Read the processed file and Save to C05 (MySQL)
                    byte[] processedBytes = Files.readAllBytes(tempOut.toPath());
                    boolean saved = saveToDatabase(jobId, processedBytes);
                    
                    if (saved) {
                        System.out.println(" [v] Job Complete. Saved to Database.");
                        notifyStatus(jobId, channel);
                    } else {
                        System.err.println(" [X] Job processed but failed to save to DB.");
                    }

                    notifyStatus(jobId, channel);
                } else {
                    System.err.println(" [X] MPI Worker Failed.");
                }

                // 5. Cleanup temp files to keep container clean
                tempIn.delete();
                tempOut.delete();

            } catch (Exception e) {
                System.err.println(" [!] Processing Error: " + e.getMessage());
            }
        };

        channel.basicConsume(QUEUE_NAME, true, deliverCallback, consumerTag -> {});
    }

    private static boolean saveToDatabase(String jobId, byte[] imageBlob) {
        String sql = "INSERT INTO processed_images (job_id, image_data, processed_at) VALUES (?, ?, NOW())";
        
        try (java.sql.Connection dbConn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            PreparedStatement pstmt = dbConn.prepareStatement(sql)) {
            
            pstmt.setString(1, jobId);
            pstmt.setBytes(2, imageBlob);
            
            int rowsAffected = pstmt.executeUpdate();
            return rowsAffected > 0; // Success if at least one row was added
            
        } catch (Exception e) {
            System.err.println(" [!] DB Error: " + e.getMessage());
            return false; // Fail silently so the main loop can handle the error
        }
    }

    private static String getJsonValue(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int start = json.indexOf(pattern) + pattern.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private static void notifyStatus(String jobId, com.rabbitmq.client.Channel channel) {
    try {
        String exchangeName = "hsm_topic_exchange";
        String routingKey = "hsm.status.finished";
        
        // Match the NestJS pattern: { "pattern": "...", "data": { ... } }
        String notification = "{\"pattern\":\"hsm.status.finished\",\"data\":{\"jobId\":\"" + jobId + "\"}}";
        
        channel.basicPublish(exchangeName, routingKey, null, notification.getBytes(StandardCharsets.UTF_8));
        System.out.println(" [>] Notification sent back to C01 Gateway.");
    } catch (Exception e) {
        System.err.println(" [!] Failed to notify status: " + e.getMessage());
    }
}
}