export type Persona = {
  interno?: number;
  cuil: number;
  nombreEmpleador: string;
  internoAfiliadoDatos?: string;
  periodo?: number;
}

export type Parameters = {
  CUIT?: number;
  VerIndependientes?: boolean;
  periodo?: number;
  page?: string;
  sort?: string;
};

export default Persona;
