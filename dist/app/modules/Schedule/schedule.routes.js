"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const schedule_controller_1 = require("./schedule.controller");
const router = express_1.default.Router();
router.get('/', (0, auth_1.default)(client_1.UserRole.DOCTOR, client_1.UserRole.ADMIN, client_1.UserRole.SUPER_ADMIN), schedule_controller_1.ScheduleController.getAllFromDB);
/**
 * API ENDPOINT: /schedule/:id
 *
 * Get schedule data by id
 */
router.get('/:id', (0, auth_1.default)(client_1.UserRole.SUPER_ADMIN, client_1.UserRole.ADMIN, client_1.UserRole.DOCTOR, client_1.UserRole.PATIENT), schedule_controller_1.ScheduleController.getByIdFromDB);
router.post('/', (0, auth_1.default)(client_1.UserRole.SUPER_ADMIN, client_1.UserRole.ADMIN), schedule_controller_1.ScheduleController.insertIntoDB);
/**
 * API ENDPOINT: /schdeule/:id
 *
 * Delete schedule data by id
 */
router.delete('/:id', (0, auth_1.default)(client_1.UserRole.SUPER_ADMIN, client_1.UserRole.ADMIN), schedule_controller_1.ScheduleController.deleteFromDB);
exports.ScheduleRoutes = router;
