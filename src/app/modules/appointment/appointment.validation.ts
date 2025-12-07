import { z } from 'zod';

const createAppointment = z.object({
    body: z.object({
        doctorId: z.string({
            error: "Doctor Id is required!"
        }),
        scheduleId: z.string({
            error: "Doctor schedule id is required!"
        })
    })
});

export const AppointmentValidation = {
    createAppointment
};
