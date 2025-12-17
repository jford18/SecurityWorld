import { Router } from "express";
import { getEncodingDevices } from "../controllers/hikEncodingDevices.controller.js";

const router = Router();

router.get("/encoding-devices", getEncodingDevices);

export default router;
