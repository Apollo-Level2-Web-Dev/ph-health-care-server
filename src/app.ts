import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import cron from 'node-cron';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import { AppointmentService } from './app/modules/Appointment/appointment.service';
import { PaymentController } from './app/modules/Payment/payment.controller';
import router from './app/routes';

const app: Application = express();
app.use(cookieParser());

app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    PaymentController.handleStripeWebhookEvent
);

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));

//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


cron.schedule('*/5 * * * *', () => {
    try {
        console.log("🔄 Running unpaid appointment cleanup at", new Date().toISOString());
        AppointmentService.cancelUnpaidAppointments();
    } catch (err) {
        console.error("❌ Cron job error:", err);
    }
});

app.get('/', (req: Request, res: Response) => {
    res.send({
        Message: "Ph health care server.."
    })
});

app.use('/api/v1', router);

app.use(globalErrorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: "API NOT FOUND!",
        error: {
            path: req.originalUrl,
            message: "Your requested path is not found!"
        }
    })
})

export default app;