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
exports.PatientService = void 0;
const client_1 = require("@prisma/client");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const patient_constants_1 = require("./patient.constants");
const getAllFromDB = (filters_1, options_1, ...args_1) => __awaiter(void 0, [filters_1, options_1, ...args_1], void 0, function* (filters, options, includeHealthData = false // NEW PARAMETER
) {
    const { limit, page, skip } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const { searchTerm } = filters, filterData = __rest(filters, ["searchTerm"]);
    const andConditions = [];
    if (searchTerm) {
        andConditions.push({
            OR: patient_constants_1.patientSearchableFields.map((field) => ({
                [field]: {
                    contains: searchTerm,
                    mode: "insensitive",
                },
            })),
        });
    }
    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map((key) => {
                return {
                    [key]: {
                        equals: filterData[key],
                    },
                };
            }),
        });
    }
    andConditions.push({
        isDeleted: false,
    });
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    // Conditional include based on parameter
    const includeClause = includeHealthData
        ? {
            medicalReport: true,
            patientHealthData: true,
        }
        : {
            medicalReport: {
                select: {
                    id: true,
                    reportName: true,
                    createdAt: true,
                },
            },
        };
    const result = yield prisma_1.default.patient.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder
            ? { [options.sortBy]: options.sortOrder }
            : {
                createdAt: "desc",
            },
        include: includeClause,
    });
    const total = yield prisma_1.default.patient.count({
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
const getByIdFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.patient.findUnique({
        where: {
            id,
            isDeleted: false,
        },
        include: {
            medicalReport: true,
            patientHealthData: true,
        },
    });
    return result;
});
const updateIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { patientHealthData, medicalReport } = payload, patientData = __rest(payload, ["patientHealthData", "medicalReport"]);
    const patientInfo = yield prisma_1.default.patient.findUniqueOrThrow({
        where: {
            id,
            isDeleted: false
        }
    });
    yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        //update patient data
        yield transactionClient.patient.update({
            where: {
                id
            },
            data: patientData,
            include: {
                patientHealthData: true,
                medicalReport: true
            }
        });
        // create or update patient health data
        if (patientHealthData) {
            yield transactionClient.patientHealthData.upsert({
                where: {
                    patientId: patientInfo.id
                },
                update: patientHealthData,
                create: Object.assign(Object.assign({}, patientHealthData), { patientId: patientInfo.id })
            });
        }
        ;
        if (medicalReport) {
            yield transactionClient.medicalReport.create({
                data: Object.assign(Object.assign({}, medicalReport), { patientId: patientInfo.id })
            });
        }
    }));
    const responseData = yield prisma_1.default.patient.findUnique({
        where: {
            id: patientInfo.id
        },
        include: {
            patientHealthData: true,
            medicalReport: true
        }
    });
    return responseData;
});
const deleteFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // delete medical report
        yield tx.medicalReport.deleteMany({
            where: {
                patientId: id
            }
        });
        // delete patient health data
        yield tx.patientHealthData.delete({
            where: {
                patientId: id
            }
        });
        const deletedPatient = yield tx.patient.delete({
            where: {
                id
            }
        });
        yield tx.user.delete({
            where: {
                email: deletedPatient.email
            }
        });
        return deletedPatient;
    }));
    return result;
});
const softDelete = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedPatient = yield transactionClient.patient.update({
            where: { id },
            data: {
                isDeleted: true,
            },
        });
        yield transactionClient.user.update({
            where: {
                email: deletedPatient.email,
            },
            data: {
                status: client_1.UserStatus.DELETED,
            },
        });
        return deletedPatient;
    }));
});
exports.PatientService = {
    getAllFromDB,
    getByIdFromDB,
    updateIntoDB,
    deleteFromDB,
    softDelete,
};
