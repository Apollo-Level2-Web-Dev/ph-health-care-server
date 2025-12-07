"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const rateLimiter_1 = require("../../middlewares/rateLimiter");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const appointment_controller_1 = require("./appointment.controller");
const appointment_validation_1 = require("./appointment.validation");
const router = express_1.default.Router();
/**
 * ENDPOINT: /appointment/
 *
 * Get all appointment with filtering
 * Only accessable for Admin & Super Admin
 */
router.get('/', (0, auth_1.default)(client_1.UserRole.SUPER_ADMIN, client_1.UserRole.ADMIN), appointment_controller_1.AppointmentController.getAllFromDB);
router.get('/my-appointment', (0, auth_1.default)(client_1.UserRole.PATIENT, client_1.UserRole.DOCTOR), appointment_controller_1.AppointmentController.getMyAppointment);
router.post('/', (0, auth_1.default)(client_1.UserRole.PATIENT), rateLimiter_1.paymentLimiter, (0, validateRequest_1.default)(appointment_validation_1.AppointmentValidation.createAppointment), appointment_controller_1.AppointmentController.createAppointment);
router.post('/pay-later', (0, auth_1.default)(client_1.UserRole.PATIENT), (0, validateRequest_1.default)(appointment_validation_1.AppointmentValidation.createAppointment), appointment_controller_1.AppointmentController.createAppointmentWithPayLater);
router.post('/:id/initiate-payment', (0, auth_1.default)(client_1.UserRole.PATIENT), rateLimiter_1.paymentLimiter, appointment_controller_1.AppointmentController.initiatePayment);
router.patch('/status/:id', (0, auth_1.default)(client_1.UserRole.SUPER_ADMIN, client_1.UserRole.ADMIN, client_1.UserRole.DOCTOR), appointment_controller_1.AppointmentController.changeAppointmentStatus);
router.post('/pay-later', (0, auth_1.default)(client_1.UserRole.PATIENT), appointment_controller_1.AppointmentController.createAppointmentWithPayLater);
exports.AppointmentRoutes = router;
