export const buildMaterialSustraidoCountQuery = (whereClause = '') => `
SELECT COUNT(1) AS TOTAL
FROM MATERIAL_SUSTRAIDO A
${whereClause}
`;

export const buildMaterialSustraidoListQuery = (whereClause, limitIndex, offsetIndex) => `
SELECT
  A.ID,
  A.DESCRIPCION,
  A.ESTADO
FROM MATERIAL_SUSTRAIDO A
${whereClause}
ORDER BY A.ID ASC
LIMIT $${limitIndex}
OFFSET $${offsetIndex}
`;

export const getMaterialSustraidoByIdQuery = `
SELECT
  A.ID,
  A.DESCRIPCION,
  A.ESTADO
FROM MATERIAL_SUSTRAIDO A
WHERE A.ID = $1
`;

export const insertMaterialSustraidoQuery = `
INSERT INTO MATERIAL_SUSTRAIDO (DESCRIPCION, ESTADO)
VALUES ($1, $2)
RETURNING ID, DESCRIPCION, ESTADO
`;

export const buildUpdateMaterialSustraidoQuery = (setClause, idIndex) => `
UPDATE MATERIAL_SUSTRAIDO
SET ${setClause}
WHERE ID = $${idIndex}
RETURNING ID, DESCRIPCION, ESTADO
`;

export const softDeleteMaterialSustraidoQuery = `
UPDATE MATERIAL_SUSTRAIDO
SET ESTADO = FALSE
WHERE ID = $1 AND ESTADO = TRUE
RETURNING ID
`;

export const findMaterialSustraidoByDescripcionQuery = (excludeId) => {
  const baseQuery = `
SELECT ID
FROM MATERIAL_SUSTRAIDO A
WHERE LOWER(A.DESCRIPCION) = LOWER($1)
`;

  if (!excludeId) {
    return `${baseQuery}LIMIT 1`;
  }

  return `${baseQuery}AND A.ID <> $2
LIMIT 1`;
};
