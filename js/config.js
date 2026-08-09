window.FleetConfig = {
  STATUS_MAP: {
    'OPERATIVO': 'operativo',
    'EN RUTA': 'operativo',
    'DISPONIBLE': 'operativo',
    'EN SERVICIO': 'operativo',
    'EN USO': 'operativo',
    'EN REPARACION': 'en_reparacion',
    'EN TALLER': 'en_reparacion',
    'TALLER': 'en_reparacion',
    'MANTENIMIENTO': 'en_reparacion',
    'REPARACION': 'en_reparacion',
    'INOPERATIVO': 'inactivo',
    'INACTIVO': 'inactivo',
    'PARADO': 'inactivo',
    'FUERA DE SERVICIO': 'inactivo',
    'POR DESINCORPORAR': 'por_desincorporar',
    'DESINCORPORADO': 'desincorporado',
    'POR UBICAR': 'por_ubicar',
    'HURTADO': 'hurtado',
    'OTROS ENTES': 'otros_entes',
    'ASIGNADO': 'otros_entes',
    'ASIGNADO A OPERADOR': 'otros_entes'
  },

  STATUS_ORDER: [
    { key: 'operativo',         label: 'Operativo',         color: '#10B981', soft: '#ECFDF5', text: '#047857' },
    { key: 'en_reparacion',     label: 'En reparación',     color: '#3B82F6', soft: '#EFF6FF', text: '#1D4ED8' },
    { key: 'inactivo',          label: 'Inactivo',          color: '#FBBF24', soft: '#FFFBEB', text: '#B45309' },
    { key: 'por_desincorporar', label: 'Por desincorporar', color: '#F97316', soft: '#FFF7ED', text: '#C2410C' },
    { key: 'desincorporado',    label: 'Desincorporado',    color: '#94A3B8', soft: '#F8FAFC', text: '#475569' },
    { key: 'por_ubicar',        label: 'Por ubicar',        color: '#8B5CF6', soft: '#F5F3FF', text: '#6D28D9' },
    { key: 'hurtado',           label: 'Hurtado',           color: '#EF4444', soft: '#FEF2F2', text: '#B91C1C' },
    { key: 'otros_entes',       label: 'Otros entes',       color: '#64748B', soft: '#F1F5F9', text: '#334155' },
    { key: 'sin_clasificar',    label: 'Sin clasificar',    color: '#9CA3AF', soft: '#F3F4F6', text: '#4B5563' }
  ],

  STATUS_COLUMN_CANDIDATES: [
    'situacion (estatus)', 'estatus', 'estado_vehiculo', 'situacion', 'condicion'
  ],
  GEO_COLUMN_CANDIDATES: ['estado', 'estado_geografico', 'ubicacion'],
  FUEL_COLUMN_CANDIDATES: ['tipo combustible', 'combustible'],
  GERENCIA_COLUMN_CANDIDATES: ['gerencia', 'unidad usuaria'],
  GPS_COLUMN_CANDIDATES: ['gps'],
  VERIFICADO_COLUMN_CANDIDATES: ['verificado'],

  normalize(value) {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  },

  toSemantic(raw) {
    const norm = this.normalize(raw);
    if (!norm) return null;
    return this.STATUS_MAP[norm] ?? 'sin_clasificar';
  }
};
