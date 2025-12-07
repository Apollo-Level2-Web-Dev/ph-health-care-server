"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const http_status_1 = __importDefault(require("http-status"));
// Sanitize error to prevent exposing sensitive information in production
const sanitizeError = (error) => {
    var _a;
    // Don't expose Prisma errors in production
    if (process.env.NODE_ENV === "production" && ((_a = error.code) === null || _a === void 0 ? void 0 : _a.startsWith("P"))) {
        return {
            message: "Database operation failed",
            errorDetails: null,
        };
    }
    return error;
};
const globalErrorHandler = (err, req, res, next) => {
    console.log({ err });
    let statusCode = http_status_1.default.INTERNAL_SERVER_ERROR;
    let success = false;
    let message = err.message || "Something went wrong!";
    let error = err;
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        message = 'Validation Error';
        error = err.message;
    }
    else if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            message = "Duplicate Key error";
            error = err.meta;
        }
    }
    // Sanitize error before sending response
    const sanitizedError = sanitizeError(error);
    res.status(statusCode).json({
        success,
        message,
        error: sanitizedError
    });
};
exports.default = globalErrorHandler;
