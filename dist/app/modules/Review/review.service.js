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
exports.ReviewService = void 0;
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const insertIntoDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const patientData = yield prisma_1.default.patient.findUniqueOrThrow({
        where: {
            email: user === null || user === void 0 ? void 0 : user.email
        }
    });
    const appointmentData = yield prisma_1.default.appointment.findUniqueOrThrow({
        where: {
            id: payload.appointmentId
        }
    });
    if (appointmentData.paymentStatus !== client_1.PaymentStatus.PAID) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Payment must be completed before submitting a review");
    }
    if (!(patientData.id === appointmentData.patientId)) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "This is not your appointment!");
    }
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield tx.review.create({
            data: {
                appointmentId: appointmentData.id,
                doctorId: appointmentData.doctorId,
                patientId: appointmentData.patientId,
                rating: payload.rating,
                comment: payload.comment
            }
        });
        const averageRating = yield tx.review.aggregate({
            _avg: {
                rating: true
            }
        });
        yield tx.doctor.update({
            where: {
                id: result.doctorId
            },
            data: {
                averageRating: averageRating._avg.rating
            }
        });
        return result;
    }));
});
const getAllFromDB = (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { limit, page, skip } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const { patientEmail, doctorEmail } = filters;
    const andConditions = [];
    if (patientEmail) {
        andConditions.push({
            patient: {
                email: patientEmail
            }
        });
    }
    if (doctorEmail) {
        andConditions.push({
            doctor: {
                email: doctorEmail
            }
        });
    }
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    const result = yield prisma_1.default.review.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder
            ? { [options.sortBy]: options.sortOrder }
            : {
                createdAt: 'desc',
            },
        include: {
            doctor: true,
            patient: true,
            appointment: true,
        },
    });
    const total = yield prisma_1.default.review.count({
        where: whereConditions,
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
exports.ReviewService = {
    insertIntoDB,
    getAllFromDB
};
