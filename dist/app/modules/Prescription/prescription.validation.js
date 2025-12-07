"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescriptionValidation = void 0;
const zod_1 = require("zod");
const create = zod_1.z.object({
    body: zod_1.z.object({
        appointmentId: zod_1.z.string({
            error: 'Appointment Id is required',
        }),
        instructions: zod_1.z.string({
            error: 'Instructions is required',
        }),
    }),
});
exports.PrescriptionValidation = {
    create,
};
