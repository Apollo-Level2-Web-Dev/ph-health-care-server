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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentService = void 0;
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
const uuid_1 = require("uuid");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const stripe_1 = require("../../../helpers/stripe");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const createAppointment = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const patientData = yield prisma_1.default.patient.findUniqueOrThrow({
        where: {
            email: user === null || user === void 0 ? void 0 : user.email
        }
    });
    const doctorData = yield prisma_1.default.doctor.findUniqueOrThrow({
        where: {
            id: payload.doctorId,
            isDeleted: false
        }
    });
    yield prisma_1.default.doctorSchedules.findFirstOrThrow({
        where: {
            doctorId: doctorData.id,
            scheduleId: payload.scheduleId,
            isBooked: false
        }
    });
    const videoCallingId = (0, uuid_1.v4)();
    const result = yield prisma_1.default.$transaction((tnx) => __awaiter(void 0, void 0, void 0, function* () {
        const appointmentData = yield tnx.appointment.create({
            data: {
                patientId: patientData.id,
                doctorId: doctorData.id,
                scheduleId: payload.scheduleId,
                videoCallingId
            }
        });
        yield tnx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: {
                    doctorId: doctorData.id,
                    scheduleId: payload.scheduleId
                }
            },
            data: {
                isBooked: true
            }
        });
        const transactionId = (0, uuid_1.v4)();
        const paymentData = yield tnx.payment.create({
            data: {
                appointmentId: appointmentData.id,
                amount: doctorData.appointmentFee,
                transactionId
            }
        });
        const session = yield stripe_1.stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: (user === null || user === void 0 ? void 0 : user.email) || '',
            line_items: [
                {
                    price_data: {
                        currency: "bdt",
                        product_data: {
                            name: `Appointment with ${doctorData.name}`,
                        },
                        unit_amount: doctorData.appointmentFee * 100,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                appointmentId: appointmentData.id,
                paymentId: paymentData.id
            },
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/my-appointments`,
        });
        return { paymentUrl: session.url };
    }));
    return result;
});
const getMyAppointment = (user, filters, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const filterData = __rest(filters, []);
    const andConditions = [];
    if ((user === null || user === void 0 ? void 0 : user.role) === client_1.UserRole.PATIENT) {
        andConditions.push({
            patient: {
                email: user === null || user === void 0 ? void 0 : user.email
            }
        });
    }
    else if ((user === null || user === void 0 ? void 0 : user.role) === client_1.UserRole.DOCTOR) {
        andConditions.push({
            doctor: {
                email: user === null || user === void 0 ? void 0 : user.email
            }
        });
    }
    if (Object.keys(filterData).length > 0) {
        const filterConditions = Object.keys(filterData).map(key => ({
            [key]: {
                equals: filterData[key]
            }
        }));
        andConditions.push(...filterConditions);
    }
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    const result = yield prisma_1.default.appointment.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: (user === null || user === void 0 ? void 0 : user.role) === client_1.UserRole.DOCTOR ?
            {
                patient: true,
                schedule: true,
                prescription: true,
                review: true,
                payment: true,
                doctor: {
                    include: {
                        doctorSpecialties: {
                            include: {
                                specialities: true
                            }
                        }
                    }
                }
            } : {
            doctor: {
                include: {
                    doctorSpecialties: {
                        include: {
                            specialities: true
                        }
                    }
                }
            },
            schedule: true,
            prescription: true,
            review: true,
            payment: true,
            patient: true
        }
    });
    const total = yield prisma_1.default.appointment.count({
        where: whereConditions
    });
    return {
        meta: {
            total,
            limit,
            page
        },
        data: result
    };
});
// task get all data from db (appointment data) - admin
const updateAppointmentStatus = (appointmentId, status, user) => __awaiter(void 0, void 0, void 0, function* () {
    const appointmentData = yield prisma_1.default.appointment.findUniqueOrThrow({
        where: {
            id: appointmentId
        },
        include: {
            doctor: true
        }
    });
    if ((user === null || user === void 0 ? void 0 : user.role) === client_1.UserRole.DOCTOR) {
        if (!((user === null || user === void 0 ? void 0 : user.email) === appointmentData.doctor.email))
            throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "This is not your appointment");
    }
    return yield prisma_1.default.appointment.update({
        where: {
            id: appointmentId
        },
        data: {
            status
        }
    });
});
const getAllFromDB = (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { limit, page, skip } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const { patientEmail, doctorEmail } = filters, filterData = __rest(filters, ["patientEmail", "doctorEmail"]);
    const andConditions = [];
    if (patientEmail) {
        andConditions.push({
            patient: {
                email: patientEmail
            }
        });
    }
    else if (doctorEmail) {
        andConditions.push({
            doctor: {
                email: doctorEmail
            }
        });
    }
    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map((key) => {
                return {
                    [key]: {
                        equals: filterData[key]
                    }
                };
            })
        });
    }
    // console.dir(andConditions, { depth: Infinity })
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    const result = yield prisma_1.default.appointment.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder
            ? { [options.sortBy]: options.sortOrder }
            : {
                createdAt: 'desc',
            },
        include: {
            doctor: {
                include: {
                    doctorSpecialties: {
                        include: {
                            specialities: true
                        }
                    }
                }
            },
            patient: true,
            schedule: true,
            prescription: true,
            review: true,
            payment: true
        }
    });
    const total = yield prisma_1.default.appointment.count({
        where: whereConditions
    });
    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };
});
const cancelUnpaidAppointments = () => __awaiter(void 0, void 0, void 0, function* () {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const unPaidAppointments = yield prisma_1.default.appointment.findMany({
        where: {
            createdAt: {
                lte: thirtyMinAgo
            },
            paymentStatus: client_1.PaymentStatus.UNPAID
        }
    });
    const appointmentIdsToCancel = unPaidAppointments.map(appointment => appointment.id);
    yield prisma_1.default.$transaction((tnx) => __awaiter(void 0, void 0, void 0, function* () {
        // Update appointments to CANCELED status instead of deleting
        yield tnx.appointment.updateMany({
            where: {
                id: {
                    in: appointmentIdsToCancel
                }
            },
            data: {
                status: client_1.AppointmentStatus.CANCELED
            }
        });
        // Delete associated payments
        yield tnx.payment.deleteMany({
            where: {
                appointmentId: {
                    in: appointmentIdsToCancel
                }
            }
        });
        // Free up doctor schedules
        for (const unPaidAppointment of unPaidAppointments) {
            yield tnx.doctorSchedules.update({
                where: {
                    doctorId_scheduleId: {
                        doctorId: unPaidAppointment.doctorId,
                        scheduleId: unPaidAppointment.scheduleId
                    }
                },
                data: {
                    isBooked: false
                }
            });
        }
    }));
});
const createAppointmentWithPayLater = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const patientData = yield prisma_1.default.patient.findUniqueOrThrow({
        where: {
            email: user === null || user === void 0 ? void 0 : user.email
        }
    });
    const doctorData = yield prisma_1.default.doctor.findUniqueOrThrow({
        where: {
            id: payload.doctorId,
            isDeleted: false
        }
    });
    yield prisma_1.default.doctorSchedules.findFirstOrThrow({
        where: {
            doctorId: doctorData.id,
            scheduleId: payload.scheduleId,
            isBooked: false
        }
    });
    const videoCallingId = (0, uuid_1.v4)();
    const result = yield prisma_1.default.$transaction((tnx) => __awaiter(void 0, void 0, void 0, function* () {
        const appointmentData = yield tnx.appointment.create({
            data: {
                patientId: patientData.id,
                doctorId: doctorData.id,
                scheduleId: payload.scheduleId,
                videoCallingId
            },
            include: {
                patient: true,
                doctor: true,
                schedule: true
            }
        });
        yield tnx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: {
                    doctorId: doctorData.id,
                    scheduleId: payload.scheduleId
                }
            },
            data: {
                isBooked: true
            }
        });
        const transactionId = (0, uuid_1.v4)();
        yield tnx.payment.create({
            data: {
                appointmentId: appointmentData.id,
                amount: doctorData.appointmentFee,
                transactionId
            }
        });
        return appointmentData;
    }));
    return result;
});
const initiatePaymentForAppointment = (appointmentId, user) => __awaiter(void 0, void 0, void 0, function* () {
    const patientData = yield prisma_1.default.patient.findUniqueOrThrow({
        where: {
            email: user === null || user === void 0 ? void 0 : user.email
        }
    });
    const appointment = yield prisma_1.default.appointment.findUnique({
        where: {
            id: appointmentId,
            patientId: patientData.id
        },
        include: {
            payment: true,
            doctor: true
        }
    });
    if (!appointment) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Appointment not found or unauthorized");
    }
    if (appointment.paymentStatus !== client_1.PaymentStatus.UNPAID) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Payment already completed for this appointment");
    }
    if (appointment.status === client_1.AppointmentStatus.CANCELED) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot pay for cancelled appointment");
    }
    // Create Stripe checkout session
    const session = yield stripe_1.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: (user === null || user === void 0 ? void 0 : user.email) || '',
        line_items: [
            {
                price_data: {
                    currency: "bdt",
                    product_data: {
                        name: `Appointment with ${appointment.doctor.name}`,
                    },
                    unit_amount: appointment.payment.amount * 100,
                },
                quantity: 1,
            },
        ],
        metadata: {
            appointmentId: appointment.id,
            paymentId: appointment.payment.id
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/my-appointments`,
    });
    return { paymentUrl: session.url };
});
exports.AppointmentService = {
    createAppointment,
    getMyAppointment,
    updateAppointmentStatus,
    getAllFromDB,
    cancelUnpaidAppointments,
    createAppointmentWithPayLater,
    initiatePaymentForAppointment
};
