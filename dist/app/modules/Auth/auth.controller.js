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
exports.AuthController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../../config"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const auth_service_1 = require("./auth.service");
const loginUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const accessTokenExpiresIn = config_1.default.jwt.expires_in;
    const refreshTokenExpiresIn = config_1.default.jwt.refresh_token_expires_in;
    // convert accessTokenExpiresIn to milliseconds
    let accessTokenMaxAge = 0;
    const accessTokenUnit = accessTokenExpiresIn.slice(-1);
    const accessTokenValue = parseInt(accessTokenExpiresIn.slice(0, -1));
    if (accessTokenUnit === "y") {
        accessTokenMaxAge = accessTokenValue * 365 * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "M") {
        accessTokenMaxAge = accessTokenValue * 30 * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "w") {
        accessTokenMaxAge = accessTokenValue * 7 * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "d") {
        accessTokenMaxAge = accessTokenValue * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "h") {
        accessTokenMaxAge = accessTokenValue * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "m") {
        accessTokenMaxAge = accessTokenValue * 60 * 1000;
    }
    else if (accessTokenUnit === "s") {
        accessTokenMaxAge = accessTokenValue * 1000;
    }
    else {
        accessTokenMaxAge = 1000 * 60 * 60; // default 1 hour
    }
    // convert refreshTokenExpiresIn to milliseconds
    let refreshTokenMaxAge = 0;
    const refreshTokenUnit = refreshTokenExpiresIn.slice(-1);
    const refreshTokenValue = parseInt(refreshTokenExpiresIn.slice(0, -1));
    if (refreshTokenUnit === "y") {
        refreshTokenMaxAge = refreshTokenValue * 365 * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "M") {
        refreshTokenMaxAge = refreshTokenValue * 30 * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "w") {
        refreshTokenMaxAge = refreshTokenValue * 7 * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "d") {
        refreshTokenMaxAge = refreshTokenValue * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "h") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "m") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 1000;
    }
    else if (refreshTokenUnit === "s") {
        refreshTokenMaxAge = refreshTokenValue * 1000;
    }
    else {
        refreshTokenMaxAge = 1000 * 60 * 60 * 24 * 30; // default 30 days
    }
    const result = yield auth_service_1.AuthServices.loginUser(req.body);
    const { refreshToken, accessToken } = result;
    res.cookie("accessToken", accessToken, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: accessTokenMaxAge,
    });
    res.cookie("refreshToken", refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: refreshTokenMaxAge,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Logged in successfully!",
        data: {
            needPasswordChange: result.needPasswordChange,
        }
    });
}));
const refreshToken = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.cookies;
    /*
    EXPIRES_IN=7d
  
  REFRESH_TOKEN_EXPIRES_IN=1y
    */
    const accessTokenExpiresIn = config_1.default.jwt.expires_in;
    const refreshTokenExpiresIn = config_1.default.jwt.refresh_token_expires_in;
    // convert accessTokenExpiresIn to milliseconds
    let accessTokenMaxAge = 0;
    const accessTokenUnit = accessTokenExpiresIn.slice(-1);
    const accessTokenValue = parseInt(accessTokenExpiresIn.slice(0, -1));
    if (accessTokenUnit === "y") {
        accessTokenMaxAge = accessTokenValue * 365 * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "M") {
        accessTokenMaxAge = accessTokenValue * 30 * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "w") {
        accessTokenMaxAge = accessTokenValue * 7 * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "d") {
        accessTokenMaxAge = accessTokenValue * 24 * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "h") {
        accessTokenMaxAge = accessTokenValue * 60 * 60 * 1000;
    }
    else if (accessTokenUnit === "m") {
        accessTokenMaxAge = accessTokenValue * 60 * 1000;
    }
    else if (accessTokenUnit === "s") {
        accessTokenMaxAge = accessTokenValue * 1000;
    }
    else {
        accessTokenMaxAge = 1000 * 60 * 60; // default 1 hour
    }
    // convert refreshTokenExpiresIn to milliseconds
    let refreshTokenMaxAge = 0;
    const refreshTokenUnit = refreshTokenExpiresIn.slice(-1);
    const refreshTokenValue = parseInt(refreshTokenExpiresIn.slice(0, -1));
    if (refreshTokenUnit === "y") {
        refreshTokenMaxAge = refreshTokenValue * 365 * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "M") {
        refreshTokenMaxAge = refreshTokenValue * 30 * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "w") {
        refreshTokenMaxAge = refreshTokenValue * 7 * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "d") {
        refreshTokenMaxAge = refreshTokenValue * 24 * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "h") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 60 * 1000;
    }
    else if (refreshTokenUnit === "m") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 1000;
    }
    else if (refreshTokenUnit === "s") {
        refreshTokenMaxAge = refreshTokenValue * 1000;
    }
    else {
        refreshTokenMaxAge = 1000 * 60 * 60 * 24 * 30; // default 30 days
    }
    const result = yield auth_service_1.AuthServices.refreshToken(refreshToken);
    res.cookie("accessToken", result.accessToken, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: accessTokenMaxAge,
    });
    res.cookie("refreshToken", result.refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: refreshTokenMaxAge,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Access token genereated successfully!",
        data: {
            message: "Access token genereated successfully!",
        },
    });
}));
const changePassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield auth_service_1.AuthServices.changePassword(user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Password Changed successfully",
        data: result,
    });
}));
const forgotPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield auth_service_1.AuthServices.forgotPassword(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Check your email!",
        data: null,
    });
}));
const resetPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const token = req.headers.authorization || "";
    yield auth_service_1.AuthServices.resetPassword(token, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Password Reset!",
        data: null,
    });
}));
const getMe = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.cookies;
    const result = yield auth_service_1.AuthServices.getMe(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "User retrieved successfully",
        data: result,
    });
}));
exports.AuthController = {
    loginUser,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe
};
