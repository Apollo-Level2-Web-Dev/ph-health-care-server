"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewRoutes = void 0;
const express_1 = __importDefault(require("express"));
const review_controller_1 = require("./review.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const client_1 = require("@prisma/client");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const review_validation_1 = require("./review.validation");
const router = express_1.default.Router();
router.get('/', review_controller_1.ReviewController.getAllFromDB);
router.post('/', (0, auth_1.default)(client_1.UserRole.PATIENT), (0, validateRequest_1.default)(review_validation_1.ReviewValidation.create), review_controller_1.ReviewController.insertIntoDB);
exports.ReviewRoutes = router;
