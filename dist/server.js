"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const seed_1 = __importDefault(require("./helpers/seed"));
const config_1 = __importDefault(require("./config"));
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        // This variable will hold our server instance
        let server;
        try {
            // Seed super admin
            yield (0, seed_1.default)();
            // Start the server
            server = app_1.default.listen(config_1.default.port, () => {
                console.log(`🚀 Server is running on http://localhost:${config_1.default.port}`);
            });
            // Function to gracefully shut down the server
            const exitHandler = () => {
                if (server) {
                    server.close(() => {
                        console.log('Server closed gracefully.');
                        process.exit(1); // Exit with a failure code
                    });
                }
                else {
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
                }
                else {
                    process.exit(1);
                }
            });
        }
        catch (error) {
            console.error('Error during server startup:', error);
            process.exit(1);
        }
    });
}
bootstrap();
