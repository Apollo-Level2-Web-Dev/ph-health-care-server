"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const admin_routes_1 = require("../modules/Admin/admin.routes");
const appointment_routes_1 = require("../modules/Appointment/appointment.routes");
const auth_routes_1 = require("../modules/Auth/auth.routes");
const doctor_routes_1 = require("../modules/Doctor/doctor.routes");
const doctorSchedule_routes_1 = require("../modules/DoctorSchedule/doctorSchedule.routes");
const meta_routes_1 = require("../modules/Meta/meta.routes");
const patient_route_1 = require("../modules/Patient/patient.route");
const payment_routes_1 = require("../modules/Payment/payment.routes");
const prescription_routes_1 = require("../modules/Prescription/prescription.routes");
const review_routes_1 = require("../modules/Review/review.routes");
const schedule_routes_1 = require("../modules/Schedule/schedule.routes");
const specialties_routes_1 = require("../modules/Specialties/specialties.routes");
const user_routes_1 = require("../modules/User/user.routes");
const router = express_1.default.Router();
router.use(rateLimiter_1.apiLimiter); // Apply to all routes
const moduleRoutes = [
    {
        path: '/user',
        route: user_routes_1.userRoutes
    },
    {
        path: '/admin',
        route: admin_routes_1.AdminRoutes
    },
    {
        path: '/auth',
        route: auth_routes_1.AuthRoutes
    },
    {
        path: '/specialties',
        route: specialties_routes_1.SpecialtiesRoutes
    },
    {
        path: '/doctor',
        route: doctor_routes_1.DoctorRoutes
    },
    {
        path: '/patient',
        route: patient_route_1.PatientRoutes
    },
    {
        path: '/schedule',
        route: schedule_routes_1.ScheduleRoutes
    },
    {
        path: '/doctor-schedule',
        route: doctorSchedule_routes_1.DoctorScheduleRoutes
    },
    {
        path: '/appointment',
        route: appointment_routes_1.AppointmentRoutes
    },
    {
        path: '/payment',
        route: payment_routes_1.PaymentRoutes
    },
    {
        path: '/prescription',
        route: prescription_routes_1.PrescriptionRoutes
    },
    {
        path: '/review',
        route: review_routes_1.ReviewRoutes
    },
    {
        path: '/meta',
        route: meta_routes_1.MetaRoutes
    }
];
moduleRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
