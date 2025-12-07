"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.userService = void 0;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const config_1 = __importDefault(require("../../../config"));
const fileUploader_1 = require("../../../helpers/fileUploader");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const user_constant_1 = require("./user.constant");
const createAdmin = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const file = req.file;
    if (file) {
        const uploadToCloudinary = yield fileUploader_1.fileUploader.uploadToCloudinary(file);
        req.body.admin.profilePhoto = uploadToCloudinary === null || uploadToCloudinary === void 0 ? void 0 : uploadToCloudinary.secure_url;
    }
    const hashedPassword = yield bcrypt.hash(req.body.password, Number(config_1.default.salt_round));
    const userData = {
        email: req.body.admin.email,
        password: hashedPassword,
        role: client_1.UserRole.ADMIN
    };
    const result = yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        yield transactionClient.user.create({
            data: userData
        });
        const createdAdminData = yield transactionClient.admin.create({
            data: req.body.admin
        });
        return createdAdminData;
    }));
    return result;
});
const createDoctor = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const file = req.file;
    if (file) {
        const uploadToCloudinary = yield fileUploader_1.fileUploader.uploadToCloudinary(file);
        req.body.doctor.profilePhoto = uploadToCloudinary === null || uploadToCloudinary === void 0 ? void 0 : uploadToCloudinary.secure_url;
    }
    const hashedPassword = yield bcrypt.hash(req.body.password, Number(config_1.default.salt_round));
    const userData = {
        email: req.body.doctor.email,
        password: hashedPassword,
        role: client_1.UserRole.DOCTOR,
    };
    // Extract specialties from doctor data
    const _a = req.body.doctor, { specialties } = _a, doctorData = __rest(_a, ["specialties"]);
    const result = yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: Create user
        yield transactionClient.user.create({
            data: userData,
        });
        // Step 2: Create doctor
        const createdDoctorData = yield transactionClient.doctor.create({
            data: doctorData,
        });
        // Step 3: Create doctor specialties if provided
        if (specialties && Array.isArray(specialties) && specialties.length > 0) {
            // Verify all specialties exist
            const existingSpecialties = yield transactionClient.specialties.findMany({
                where: {
                    id: {
                        in: specialties,
                    },
                },
                select: {
                    id: true,
                },
            });
            const existingSpecialtyIds = existingSpecialties.map((s) => s.id);
            const invalidSpecialties = specialties.filter((id) => !existingSpecialtyIds.includes(id));
            if (invalidSpecialties.length > 0) {
                throw new Error(`Invalid specialty IDs: ${invalidSpecialties.join(", ")}`);
            }
            // Create doctor specialties relations
            const doctorSpecialtiesData = specialties.map((specialtyId) => ({
                doctorId: createdDoctorData.id,
                specialitiesId: specialtyId,
            }));
            yield transactionClient.doctorSpecialties.createMany({
                data: doctorSpecialtiesData,
            });
        }
        // Step 4: Return doctor with specialties
        const doctorWithSpecialties = yield transactionClient.doctor.findUnique({
            where: {
                id: createdDoctorData.id,
            },
            include: {
                doctorSpecialties: {
                    include: {
                        specialities: true,
                    },
                },
            },
        });
        return doctorWithSpecialties;
    }));
    return result;
});
const createPatient = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const file = req.file;
    if (file) {
        const uploadedProfileImage = yield fileUploader_1.fileUploader.uploadToCloudinary(file);
        req.body.patient.profilePhoto = uploadedProfileImage === null || uploadedProfileImage === void 0 ? void 0 : uploadedProfileImage.secure_url;
    }
    const hashedPassword = yield bcrypt.hash(req.body.password, Number(config_1.default.salt_round));
    const userData = {
        email: req.body.patient.email,
        password: hashedPassword,
        role: client_1.UserRole.PATIENT
    };
    const result = yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        yield transactionClient.user.create({
            data: Object.assign(Object.assign({}, userData), { needPasswordChange: false })
        });
        const createdPatientData = yield transactionClient.patient.create({
            data: req.body.patient
        });
        return createdPatientData;
    }));
    return result;
});
const getAllFromDB = (params, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { page, limit, skip } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const { searchTerm } = params, filterData = __rest(params, ["searchTerm"]);
    const andConditions = [];
    if (params.searchTerm) {
        andConditions.push({
            OR: user_constant_1.userSearchAbleFields.map(field => ({
                [field]: {
                    contains: params.searchTerm,
                    mode: 'insensitive'
                }
            }))
        });
    }
    ;
    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: filterData[key]
                }
            }))
        });
    }
    ;
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    const result = yield prisma_1.default.user.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder ? {
            [options.sortBy]: options.sortOrder
        } : {
            createdAt: 'desc'
        },
        select: {
            id: true,
            email: true,
            role: true,
            needPasswordChange: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            admin: true,
            patient: true,
            doctor: true
        }
    });
    const total = yield prisma_1.default.user.count({
        where: whereConditions
    });
    return {
        meta: {
            page,
            limit,
            total
        },
        data: result
    };
});
const changeProfileStatus = (id, status) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.default.user.findUniqueOrThrow({
        where: {
            id
        }
    });
    const updateUserStatus = yield prisma_1.default.user.update({
        where: {
            id
        },
        data: status
    });
    return updateUserStatus;
});
const getMyProfile = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userInfo = yield prisma_1.default.user.findUniqueOrThrow({
        where: {
            email: user === null || user === void 0 ? void 0 : user.email,
            status: client_1.UserStatus.ACTIVE,
        },
        select: {
            id: true,
            email: true,
            needPasswordChange: true,
            role: true,
            status: true,
        },
    });
    let profileInfo;
    if (userInfo.role === client_1.UserRole.SUPER_ADMIN) {
        profileInfo = yield prisma_1.default.admin.findUnique({
            where: {
                email: userInfo.email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                profilePhoto: true,
                contactNumber: true,
                isDeleted: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    else if (userInfo.role === client_1.UserRole.ADMIN) {
        profileInfo = yield prisma_1.default.admin.findUnique({
            where: {
                email: userInfo.email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                profilePhoto: true,
                contactNumber: true,
                isDeleted: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    else if (userInfo.role === client_1.UserRole.DOCTOR) {
        profileInfo = yield prisma_1.default.doctor.findUnique({
            where: {
                email: userInfo.email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                profilePhoto: true,
                contactNumber: true,
                address: true,
                registrationNumber: true,
                experience: true,
                gender: true,
                appointmentFee: true,
                qualification: true,
                currentWorkingPlace: true,
                designation: true,
                averageRating: true,
                isDeleted: true,
                createdAt: true,
                updatedAt: true,
                doctorSpecialties: {
                    include: {
                        specialities: true,
                    },
                },
            },
        });
    }
    else if (userInfo.role === client_1.UserRole.PATIENT) {
        profileInfo = yield prisma_1.default.patient.findUnique({
            where: {
                email: userInfo.email,
            },
            select: {
                id: true,
                name: true,
                email: true,
                profilePhoto: true,
                contactNumber: true,
                address: true,
                isDeleted: true,
                createdAt: true,
                updatedAt: true,
                patientHealthData: true,
                medicalReport: {
                    select: {
                        id: true,
                        patientId: true,
                        reportName: true,
                        reportLink: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
    }
    return Object.assign(Object.assign({}, userInfo), profileInfo);
});
const updateMyProfie = (user, req) => __awaiter(void 0, void 0, void 0, function* () {
    const userInfo = yield prisma_1.default.user.findUniqueOrThrow({
        where: {
            email: user === null || user === void 0 ? void 0 : user.email,
            status: client_1.UserStatus.ACTIVE
        }
    });
    const file = req.file;
    if (file) {
        const uploadToCloudinary = yield fileUploader_1.fileUploader.uploadToCloudinary(file);
        req.body.profilePhoto = uploadToCloudinary === null || uploadToCloudinary === void 0 ? void 0 : uploadToCloudinary.secure_url;
    }
    let profileInfo;
    if (userInfo.role === client_1.UserRole.SUPER_ADMIN) {
        profileInfo = yield prisma_1.default.admin.update({
            where: {
                email: userInfo.email
            },
            data: req.body
        });
    }
    else if (userInfo.role === client_1.UserRole.ADMIN) {
        profileInfo = yield prisma_1.default.admin.update({
            where: {
                email: userInfo.email
            },
            data: req.body
        });
    }
    else if (userInfo.role === client_1.UserRole.DOCTOR) {
        profileInfo = yield prisma_1.default.doctor.update({
            where: {
                email: userInfo.email
            },
            data: req.body
        });
    }
    else if (userInfo.role === client_1.UserRole.PATIENT) {
        profileInfo = yield prisma_1.default.patient.update({
            where: {
                email: userInfo.email
            },
            data: req.body
        });
    }
    return Object.assign({}, profileInfo);
});
exports.userService = {
    createAdmin,
    createDoctor,
    createPatient,
    getAllFromDB,
    changeProfileStatus,
    getMyProfile,
    updateMyProfie
};
