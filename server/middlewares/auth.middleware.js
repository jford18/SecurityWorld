import jwt from "jsonwebtoken";

/**
 * Middleware que valida la existencia de un token JWT y expone el payload en req.user.
 * El token debe enviarse en el header Authorization con el esquema Bearer.
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ message: "Formato de token inválido" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.user = decoded;
    return next();
  } catch (error) {
    console.error("Error al verificar el token JWT", error);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

export default verifyToken;
