import { Router } from "express";
import { getEncodingDevices } from "../controllers/hikEncodingDevices.controller.js";
import { getIpSpeakers } from "../controllers/hikIpSpeakers.controller.js";

const router = Router();

router.get("/encoding-devices", getEncodingDevices);
router.get("/ip-speakers", getIpSpeakers);

export default router;
