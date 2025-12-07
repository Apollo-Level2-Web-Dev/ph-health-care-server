"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentValidation = void 0;
const zod_1 = require("zod");
const createAppointment = zod_1.z.object({
    body: zod_1.z.object({
        doctorId: zod_1.z.string({
            error: "Doctor Id is required!"
        }),
        scheduleId: zod_1.z.string({
            error: "Doctor schedule id is required!"
        })
    })
});
exports.AppointmentValidation = {
    createAppointment
};
