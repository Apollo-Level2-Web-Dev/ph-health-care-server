"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const node_cron_1 = __importDefault(require("node-cron"));
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const appointment_service_1 = require("./app/modules/Appointment/appointment.service");
const payment_controller_1 = require("./app/modules/Payment/payment.controller");
const routes_1 = __importDefault(require("./app/routes"));
const app = (0, express_1.default)();
app.use((0, cookie_parser_1.default)());
app.post("/webhook", express_1.default.raw({ type: "application/json" }), payment_controller_1.PaymentController.handleStripeWebhookEvent);
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
//parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
node_cron_1.default.schedule('*/5 * * * *', () => {
    try {
        console.log("🔄 Running unpaid appointment cleanup at", new Date().toISOString());
        appointment_service_1.AppointmentService.cancelUnpaidAppointments();
    }
    catch (err) {
        console.error("❌ Cron job error:", err);
    }
});
app.get('/', (req, res) => {
    res.send({
        Message: "Ph health care server.."
    });
});
app.use('/api/v1', routes_1.default);
app.use(globalErrorHandler_1.default);
app.use((req, res, next) => {
    res.status(http_status_1.default.NOT_FOUND).json({
        success: false,
        message: "API NOT FOUND!",
        error: {
            path: req.originalUrl,
            message: "Your requested path is not found!"
        }
    });
});
exports.default = app;
