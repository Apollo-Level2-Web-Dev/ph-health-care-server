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
exports.DoctorService = void 0;
const client_1 = require("@prisma/client");
const openRouterClient_1 = require("../../../helpers/openRouterClient");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const doctor_constants_1 = require("./doctor.constants");
const getAllFromDB = (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { limit, page, skip } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const { searchTerm, specialties } = filters, filterData = __rest(filters, ["searchTerm", "specialties"]);
    const andConditions = [];
    if (searchTerm) {
        andConditions.push({
            OR: doctor_constants_1.doctorSearchableFields.map((field) => ({
                [field]: {
                    contains: searchTerm,
                    mode: "insensitive",
                },
            })),
        });
    }
    // doctor > doctorSpecialties > specialties -> title
    // Handle multiple specialties: ?specialties=Cardiology&specialties=Neurology
    if (specialties && specialties.length > 0) {
        // Convert to array if single string
        const specialtiesArray = Array.isArray(specialties) ? specialties : [specialties];
        andConditions.push({
            doctorSpecialties: {
                some: {
                    specialities: {
                        title: {
                            in: specialtiesArray,
                            mode: "insensitive",
                        },
                    },
                },
            },
        });
    }
    if (Object.keys(filterData).length > 0) {
        const filterConditions = Object.keys(filterData).map((key) => ({
            [key]: {
                equals: filterData[key],
            },
        }));
        andConditions.push(...filterConditions);
    }
    andConditions.push({
        isDeleted: false,
    });
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    const result = yield prisma_1.default.doctor.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder
            ? { [options.sortBy]: options.sortOrder }
            : { averageRating: "desc" },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: {
                        select: {
                            title: true,
                        }
                    },
                },
            },
            doctorSchedules: {
                include: {
                    schedule: true
                }
            },
            review: {
                select: {
                    rating: true,
                },
            },
        },
    });
    // console.log(result[0].doctorSpecialties);
    const total = yield prisma_1.default.doctor.count({
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
    const result = yield prisma_1.default.doctor.findUnique({
        where: {
            id,
            isDeleted: false,
        },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: true,
                },
            },
            doctorSchedules: {
                include: {
                    schedule: true
                }
            },
            review: true,
        },
    });
    return result;
});
const updateIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { specialties, removeSpecialties } = payload, doctorData = __rest(payload, ["specialties", "removeSpecialties"]);
    const doctorInfo = yield prisma_1.default.doctor.findUniqueOrThrow({
        where: {
            id,
            isDeleted: false,
        },
    });
    yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 1: Update doctor basic data
        if (Object.keys(doctorData).length > 0) {
            yield transactionClient.doctor.update({
                where: {
                    id,
                },
                data: doctorData,
            });
        }
        // Step 2: Remove specialties if provided
        if (removeSpecialties &&
            Array.isArray(removeSpecialties) &&
            removeSpecialties.length > 0) {
            // Validate that specialties to remove exist for this doctor
            const existingDoctorSpecialties = yield transactionClient.doctorSpecialties.findMany({
                where: {
                    doctorId: doctorInfo.id,
                    specialitiesId: {
                        in: removeSpecialties,
                    },
                },
            });
            if (existingDoctorSpecialties.length !== removeSpecialties.length) {
                const foundIds = existingDoctorSpecialties.map((ds) => ds.specialitiesId);
                const notFound = removeSpecialties.filter((id) => !foundIds.includes(id));
                throw new Error(`Cannot remove non-existent specialties: ${notFound.join(", ")}`);
            }
            // Delete the specialties
            yield transactionClient.doctorSpecialties.deleteMany({
                where: {
                    doctorId: doctorInfo.id,
                    specialitiesId: {
                        in: removeSpecialties,
                    },
                },
            });
        }
        // Step 3: Add new specialties if provided
        if (specialties && Array.isArray(specialties) && specialties.length > 0) {
            // Verify all specialties exist in Specialties table
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
            // Check for duplicates - don't add specialties that already exist
            const currentDoctorSpecialties = yield transactionClient.doctorSpecialties.findMany({
                where: {
                    doctorId: doctorInfo.id,
                    specialitiesId: {
                        in: specialties,
                    },
                },
                select: {
                    specialitiesId: true,
                },
            });
            const currentSpecialtyIds = currentDoctorSpecialties.map((ds) => ds.specialitiesId);
            const newSpecialties = specialties.filter((id) => !currentSpecialtyIds.includes(id));
            // Only create new specialties that don't already exist
            if (newSpecialties.length > 0) {
                const doctorSpecialtiesData = newSpecialties.map((specialtyId) => ({
                    doctorId: doctorInfo.id,
                    specialitiesId: specialtyId,
                }));
                yield transactionClient.doctorSpecialties.createMany({
                    data: doctorSpecialtiesData,
                });
            }
        }
    }));
    // Step 4: Return updated doctor with specialties
    const result = yield prisma_1.default.doctor.findUnique({
        where: {
            id: doctorInfo.id,
        },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: true,
                },
            },
        },
    });
    return result;
});
const deleteFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        const deleteDoctor = yield transactionClient.doctor.delete({
            where: {
                id,
            },
        });
        yield transactionClient.user.delete({
            where: {
                email: deleteDoctor.email,
            },
        });
        return deleteDoctor;
    }));
});
const softDelete = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((transactionClient) => __awaiter(void 0, void 0, void 0, function* () {
        const deleteDoctor = yield transactionClient.doctor.update({
            where: { id },
            data: {
                isDeleted: true,
            },
        });
        yield transactionClient.user.update({
            where: {
                email: deleteDoctor.email,
            },
            data: {
                status: client_1.UserStatus.DELETED,
            },
        });
        return deleteDoctor;
    }));
});
const getAISuggestion = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const doctors = yield prisma_1.default.doctor.findMany({
        where: { isDeleted: false },
        include: {
            doctorSpecialties: {
                include: { specialities: true },
            },
            review: { select: { rating: true } },
        },
    });
    const systemMessage = {
        role: "system",
        content: "You are a medical recommendation assistant. Based on a patient's symptoms and doctor data including specialties and reviews, suggest the top 5 most suitable doctors return the doctors in an array with the whole data object.",
    };
    const userMessage = {
        role: "user",
        content: `
Patient Symptoms: ${input.symptoms}

Here is the list of available doctors (JSON):
${JSON.stringify(doctors)}

Instructions:
1. Analyze patient symptoms.
2. Determine most relevant specialty.
3. Pick top 5 doctors from that specialty or pick the available even if less than 5.
4. If no doctors found, return an empty array or any other doctor.
5. Prioritize based on highest ratings.
6. Return an array of doctor objects ONLY in valid JSON format.
7. Each doctor object must contain these keys: id, name, specialty, experience, averageRating, appointmentFee.

Respond ONLY with the JSON array. No extra text or explanation.
`,
    };
    const response = yield (0, openRouterClient_1.askOpenRouter)([systemMessage, userMessage]);
    const cleanedJson = response
        .replace(/```(?:json)?\s*/, "") // remove ``` or ```json
        .replace(/```$/, "") // remove ending ```
        .trim();
    const suggestedDoctors = JSON.parse(cleanedJson);
    return suggestedDoctors;
});
const getAllPublic = (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { limit, page, skip } = paginationHelper_1.paginationHelper.calculatePagination(options);
    const { searchTerm, specialties } = filters, filterData = __rest(filters, ["searchTerm", "specialties"]);
    const andConditions = [];
    if (searchTerm) {
        andConditions.push({
            OR: doctor_constants_1.doctorSearchableFields.map((field) => ({
                [field]: {
                    contains: searchTerm,
                    mode: "insensitive",
                },
            })),
        });
    }
    // Handle multiple specialties: ?specialties=Cardiology&specialties=Neurology
    if (specialties && specialties.length > 0) {
        // Convert to array if single string
        const specialtiesArray = Array.isArray(specialties) ? specialties : [specialties];
        andConditions.push({
            doctorSpecialties: {
                some: {
                    specialities: {
                        title: {
                            in: specialtiesArray,
                            mode: "insensitive",
                        },
                    },
                },
            },
        });
    }
    if (Object.keys(filterData).length > 0) {
        const filterConditions = Object.keys(filterData).map((key) => ({
            [key]: {
                equals: filterData[key],
            },
        }));
        andConditions.push(...filterConditions);
    }
    andConditions.push({
        isDeleted: false,
    });
    const whereConditions = andConditions.length > 0 ? { AND: andConditions } : {};
    const result = yield prisma_1.default.doctor.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder
            ? { [options.sortBy]: options.sortOrder }
            : { averageRating: "desc" },
        select: {
            id: true,
            name: true,
            // email: false, // Hide email in public API
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
            createdAt: true,
            updatedAt: true,
            doctorSpecialties: {
                include: {
                    specialities: true,
                },
            },
            review: {
                select: {
                    rating: true,
                    comment: true,
                    createdAt: true,
                    patient: {
                        select: {
                            name: true,
                            profilePhoto: true,
                        },
                    },
                },
            },
        },
    });
    const total = yield prisma_1.default.doctor.count({
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
exports.DoctorService = {
    updateIntoDB,
    getAllFromDB,
    getByIdFromDB,
    deleteFromDB,
    softDelete,
    getAISuggestion,
    getAllPublic,
};
