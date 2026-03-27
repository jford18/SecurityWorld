export type DashboardFalloMetrica = {
  fecha_hora_fallo: string | null;
  fecha_resolucion?: string | null;
  hora_resolucion?: string | null;
};

export const calcularPromedioGeneral = (fallos: DashboardFalloMetrica[]) => {
  let totalResueltos = 0;
  let sumaResueltos = 0;

  let totalPendientes = 0;
  let sumaPendientes = 0;

  fallos.forEach((f) => {
    if (!f?.fecha_hora_fallo) {
      return;
    }

    const inicio = new Date(f.fecha_hora_fallo);
    if (Number.isNaN(inicio.getTime())) {
      return;
    }

    if (f.fecha_resolucion) {
      const fin = new Date(`${f.fecha_resolucion} ${f.hora_resolucion || '00:00:00'}`);
      const dias = (fin.getTime() - inicio.getTime()) / 1000 / 86400;

      if (!Number.isNaN(dias)) {
        sumaResueltos += dias;
        totalResueltos++;
      }
    } else {
      const fin = new Date();
      const dias = (fin.getTime() - inicio.getTime()) / 1000 / 86400;

      if (!Number.isNaN(dias)) {
        sumaPendientes += dias;
        totalPendientes++;
      }
    }
  });

  if (totalResueltos > 0) {
    return sumaResueltos / totalResueltos;
  }

  if (totalPendientes > 0) {
    return sumaPendientes / totalPendientes;
  }

  return null;
};
