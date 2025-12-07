"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecialtiesValidtaion = void 0;
const zod_1 = require("zod");
const create = zod_1.z.object({
    title: zod_1.z.string({
        error: "Title is required!"
    })
});
exports.SpecialtiesValidtaion = {
    create
};
