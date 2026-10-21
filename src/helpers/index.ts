function fechaToDate(fecha: any): Date | null {
  try {
    if (!fecha) return null;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
      const d = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof fecha._seconds === 'number') {
      const d = new Date(fecha._seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    return null;
  } catch {
    return null;
  }
}

export default fechaToDate;
