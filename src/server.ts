import { Server } from 'http';
import app from './app';
import seedSuperAdmin from './helpers/seed';
import config from './config';


async function bootstrap() {
    // This variable will hold our server instance
    let server: Server;

    try {
        // Seed super admin
        await seedSuperAdmin();

        // Start the server
        server = app.listen(config.port, () => {
            console.log(`🚀 Server is running on http://localhost:${config.port}`);
        });

        // Function to gracefully shut down the server
        const exitHandler = () => {
            if (server) {
                server.close(() => {
                    console.log('Server closed gracefully.');
                    process.exit(1); // Exit with a failure code
                });
            } else {
                process.exit(1);
            }
        };

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (error) => {
            console.log('Unhandled Rejection is detected, we are closing our server...');
            if (server) {
                server.close(() => {
                    console.log(error);
                    process.exit(1);
                });
            } else {
                process.exit(1);
            }
        });
    } catch (error) {
        console.error('Error during server startup:', error);
        process.exit(1);
    }
}

bootstrap();