"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorScheduleValidation = void 0;
const zod_1 = require("zod");
const create = zod_1.z.object({
    body: zod_1.z.object({
        scheduleIds: zod_1.z.array(zod_1.z.string()),
    }),
});
exports.DoctorScheduleValidation = {
    create,
};
