"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecialtiesRoutes = void 0;
const express_1 = __importDefault(require("express"));
const specialties_controller_1 = require("./specialties.controller");
const fileUploader_1 = require("../../../helpers/fileUploader");
const specialties_validation_1 = require("./specialties.validation");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
// Task 1: Retrieve Specialties Data
/**
- Develop an API endpoint to retrieve all specialties data.
- Implement an HTTP GET endpoint returning specialties in JSON format.
- ENDPOINT: /specialties
*/
router.get('/', specialties_controller_1.SpecialtiesController.getAllFromDB);
router.post('/', fileUploader_1.fileUploader.upload.single('file'), (req, res, next) => {
    req.body = specialties_validation_1.SpecialtiesValidtaion.create.parse(JSON.parse(req.body.data));
    return specialties_controller_1.SpecialtiesController.insertIntoDB(req, res, next);
});
// Task 2: Delete Specialties Data by ID
/**
- Develop an API endpoint to delete specialties by ID.
- Implement an HTTP DELETE endpoint accepting the specialty ID.
- Delete the specialty from the database and return a success message.
- ENDPOINT: /specialties/:id
*/
router.delete('/:id', (0, auth_1.default)(client_1.UserRole.SUPER_ADMIN, client_1.UserRole.ADMIN), specialties_controller_1.SpecialtiesController.deleteFromDB);
exports.SpecialtiesRoutes = router;
