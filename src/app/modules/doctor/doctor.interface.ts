export type IDoctorFilterRequest = {
    searchTerm?: string | undefined;
    email?: string | undefined;
    contactNumber?: string | undefined;
    gender?: string | undefined;
    specialties?: string | undefined;
};

export type IDoctorUpdate = {
    name?: string;
    profilePhoto?: string;
    contactNumber?: string;
    address?: string;
    registrationNumber?: string;
    experience?: number;
    gender?: "MALE" | "FEMALE";
    appointmentFee?: number;
    qualification?: string;
    currentWorkingPlace?: string;
    designation?: string;
    // NEW: Simplified specialty management
    specialties?: string[]; // Array of specialty IDs to add
    removeSpecialties?: string[]; // Array of specialty IDs to remove
};

export type ISpecialties = {
    specialtiesId: string;
    isDeleted?: null;
};
