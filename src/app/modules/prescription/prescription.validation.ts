import { z } from 'zod';

const create = z.object({
    body: z.object({
        appointmentId: z.string({
            error: 'Appointment Id is required',
        }),
        instructions: z.string({
            error: 'Instructions is required',
        }),
    }),
});

export const PrescriptionValidation = {
    create,
};
