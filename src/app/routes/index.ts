import express from 'express';
import { apiLimiter } from '../middlewares/rateLimiter';
import { AdminRoutes } from '../modules/Admin/admin.routes';
import { AppointmentRoutes } from '../modules/Appointment/appointment.routes';
import { AuthRoutes } from '../modules/Auth/auth.routes';
import { DoctorRoutes } from '../modules/Doctor/doctor.routes';
import { DoctorScheduleRoutes } from '../modules/DoctorSchedule/doctorSchedule.routes';
import { MetaRoutes } from '../modules/Meta/meta.routes';
import { PatientRoutes } from '../modules/Patient/patient.route';
import { PaymentRoutes } from '../modules/Payment/payment.routes';
import { PrescriptionRoutes } from '../modules/Prescription/prescription.routes';
import { ReviewRoutes } from '../modules/Review/review.routes';
import { ScheduleRoutes } from '../modules/Schedule/schedule.routes';
import { SpecialtiesRoutes } from '../modules/Specialties/specialties.routes';
import { userRoutes } from '../modules/User/user.routes';

const router = express.Router();



router.use(apiLimiter); // Apply to all routes

const moduleRoutes = [
    {
        path: '/user',
        route: userRoutes
    },
    {
        path: '/admin',
        route: AdminRoutes
    },
    {
        path: '/auth',
        route: AuthRoutes
    },
    {
        path: '/specialties',
        route: SpecialtiesRoutes
    },
    {
        path: '/doctor',
        route: DoctorRoutes
    },
    {
        path: '/patient',
        route: PatientRoutes
    },
    {
        path: '/schedule',
        route: ScheduleRoutes
    },
    {
        path: '/doctor-schedule',
        route: DoctorScheduleRoutes
    },
    {
        path: '/appointment',
        route: AppointmentRoutes
    },
    {
        path: '/payment',
        route: PaymentRoutes
    },
    {
        path: '/prescription',
        route: PrescriptionRoutes
    },
    {
        path: '/review',
        route: ReviewRoutes
    },
    {
        path: '/meta',
        route: MetaRoutes
    }
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;