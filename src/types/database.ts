export interface Tenant {
  id: string
  name: string
  plan_id: string
  stripe_customer_id: string | null
  created_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string
  role: 'admin' | 'operator'
  created_at: string
}

export interface SubTenant {
  id: string
  tenant_id: string
  name: string
  cod_empresa: string
  cnpj?: string
  created_at: string
}

export type TransformType = 'direct' | 'padLeft6' | 'hoursToDecimal' | 'numberBR'

// One event rule: reads a source column → produces one CSV row per employee
export interface EventRule {
  event_code: string                    // fixed code, e.g. "659", "060"
  source_column: string                 // which Excel column to read
  transform: TransformType
  output_field: 'reference' | 'value'  // where the result goes in the output row
  skip_if_zero: boolean                 // skip if value is 0 or empty
}

// Rules for one Excel sheet
export interface SheetRule {
  sheet_index: number
  employee_code_column: string
  employee_code_transform: TransformType
  events: EventRule[]
}

// Top-level layout config: multiple sheets, each with multiple event rules
export interface LayoutConfig {
  sheets: SheetRule[]
}

export interface Layout {
  id: string
  sub_tenant_id: string
  name: string
  config_json: LayoutConfig
  created_at: string
}

export interface ConversionLog {
  id: string
  tenant_id: string
  sub_tenant_id: string
  layout_id: string
  file_name: string
  records_count: number
  total_value: number
  status: 'success' | 'error'
  created_at: string
  // Generated CSV text, kept for re-download. Client-side only (localStorage) —
  // must NOT be synced to the Supabase conversions_log table, which by design
  // never stores file contents (see CLAUDE.md, "Client-Side-Only File Processing").
  csv_content: string
}
