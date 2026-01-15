
export enum HumorTechnique {
  CALLBACK = 'Callback',
  PUN = 'Trocadilho',
  ONE_LINER = 'One-liner',
  IRONY = 'Ironia',
  MISDIRECTION = 'Quebra de Expectativa',
  RULE_OF_THREE = 'Regra de Três',
  EXAGGERATION = 'Exagero',
  GREG_DEAN = 'Método Greg Dean (Suposições)',
  LEO_LINS = 'Mapeamento (Estilo Leo Lins)',
  SURPRISE = 'Surpresa',
  DRAMATIC_IRONY = 'Ironia Dramática',
  SARCASM = 'Sarcasmo'
}

export interface JokePart {
  premise: string;
  setup: string;
  punchline: string;
}

export interface JokeBit {
  id: string;
  title: string;
  parts: JokePart;
  technique: HumorTechnique;
  tags: string[];
  createdAt: number;
}

export interface SuggestionResponse {
  ideas: string[];
  explanation: string;
}
