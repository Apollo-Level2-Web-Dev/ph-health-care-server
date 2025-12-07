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
exports.PaymentService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const handleStripeWebhookEvent = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Check if event has already been processed (idempotency)
    const existingPayment = yield prisma_1.default.payment.findFirst({
        where: {
            stripeEventId: event.id
        }
    });
    if (existingPayment) {
        console.log(`⚠️ Event ${event.id} already processed. Skipping.`);
        return { message: "Event already processed" };
    }
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const appointmentId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.appointmentId;
            const paymentId = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.paymentId;
            if (!appointmentId || !paymentId) {
                console.error("⚠️ Missing metadata in webhook event");
                return { message: "Missing metadata" };
            }
            // Verify appointment exists
            const appointment = yield prisma_1.default.appointment.findUnique({
                where: { id: appointmentId }
            });
            if (!appointment) {
                console.error(`⚠️ Appointment ${appointmentId} not found. Payment may be for expired appointment.`);
                return { message: "Appointment not found" };
            }
            // Update both appointment and payment in a transaction
            yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                yield tx.appointment.update({
                    where: {
                        id: appointmentId
                    },
                    data: {
                        paymentStatus: session.payment_status === "paid" ? client_1.PaymentStatus.PAID : client_1.PaymentStatus.UNPAID
                    }
                });
                yield tx.payment.update({
                    where: {
                        id: paymentId
                    },
                    data: {
                        status: session.payment_status === "paid" ? client_1.PaymentStatus.PAID : client_1.PaymentStatus.UNPAID,
                        paymentGatewayData: session,
                        stripeEventId: event.id // Store event ID for idempotency
                    }
                });
            }));
            console.log(`✅ Payment ${session.payment_status} for appointment ${appointmentId}`);
            break;
        }
        case "checkout.session.expired": {
            const session = event.data.object;
            console.log(`⚠️ Checkout session expired: ${session.id}`);
            // Appointment will be cleaned up by cron job
            break;
        }
        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            console.log(`❌ Payment failed: ${paymentIntent.id}`);
            break;
        }
        default:
            console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
    return { message: "Webhook processed successfully" };
});
exports.PaymentService = {
    handleStripeWebhookEvent
};
