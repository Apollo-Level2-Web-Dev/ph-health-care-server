import { Specialties } from "@prisma/client";
import { Request } from "express";
import { fileUploader } from "../../../helpers/fileUploader";
import prisma from "../../../shared/prisma";

const inserIntoDB = async (req: Request) => {

    const file = req.file;

    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.icon = uploadToCloudinary?.secure_url;
    }

    const result = await prisma.specialties.create({
        data: req.body
    });

    return result;
};

import { paginationHelper } from "../../../helpers/paginationHelper";
import { IPaginationOptions } from "../../interfaces/pagination";

const getAllFromDB = async (options: IPaginationOptions) => {
    const { limit, page, skip } = paginationHelper.calculatePagination(options);

    const result = await prisma.specialties.findMany({
        skip,
        take: limit,
        orderBy:
            options.sortBy && options.sortOrder
                ? { [options.sortBy]: options.sortOrder }
                : { createdAt: "desc" },
    });

    const total = await prisma.specialties.count();

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };
};

const deleteFromDB = async (id: string): Promise<Specialties> => {
    const result = await prisma.specialties.delete({
        where: {
            id,
        },
    });
    return result;
};

export const SpecialtiesService = {
    inserIntoDB,
    getAllFromDB,
    deleteFromDB
}