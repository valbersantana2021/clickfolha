import * as XLSX from 'xlsx'
import type { LayoutConfig, SheetRule, TransformType } from '@/types/database'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ParsedExcel {
  sheets: string[]
  sheetIndex: number
  headers: (string | null)[]
  rows: (string | number | boolean | null)[][]
}

export interface OutputRow {
  employee_code: string
  event_code: string
  reference: string
  value: string
}

export interface DetectedColumns {
  employee_code?: string
}

// ── Header-row detection word set ───────────────────────────────────────────────
// Exact word match (after NFD normalise + split on non-alpha chars).
// Distinguishes "Código / Nome" (real header) from "Listagem de Empregados" (title).

const PAYROLL_HEADER_WORDS = new Set([
  'codigo', 'cod', 'matricula', 'num', 'nome', 'funcionario', 'empregado',
  'horas', 'hora', 'extra', 'adicional', 'noturno', 'feriado',
  'valor', 'vlr', 'evento', 'ref', 'tipo', 'reg', 'total',
  'comissao', 'funcao', 'salario', 'saiu', 'ferias', 'entrada',
  'registro', 'descricao', 'data', 'campo',
])

// ── Auto-detect keyword map ──────────────────────────────────────────────────────

const EMP_KEYWORDS = [
  'matrícula', 'matricula', 'num. func', 'num func', 'num.func',
  'funcionario', 'funcionário', 'empregado', 'cod. func', 'codigo func',
  'código func', 'nº func', 'n. func', 'codigo', 'código',
]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// ── Parse Excel ──────────────────────────────────────────────────────────────────

export async function parseExcel(file: File, sheetIndex = 0): Promise<ParsedExcel> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheets = wb.SheetNames

  const targetSheet = Math.min(sheetIndex, sheets.length - 1)
  const ws = wb.Sheets[sheets[targetSheet]]

  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  })

  // Find the actual header row (not a title/meta row).
  // Strategy: first row where ≥2 non-null cells are ALL strings AND at least one
  // cell's words match a known payroll keyword (exact word match after NFD normalize).
  const cellHasHeaderWord = (c: string): boolean => {
    const words = normalize(c).split(/[\s/.,;:_()\-]+/).filter(Boolean)
    return words.some(w => PAYROLL_HEADER_WORDS.has(w))
  }

  const isHeaderRow = (row: (string | number | boolean | null)[]): boolean => {
    const nonNull = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '')
    if (nonNull.length < 2) return false
    if (!nonNull.every(c => typeof c === 'string')) return false
    return nonNull.some(c => cellHasHeaderWord(String(c)))
  }

  let headerRowIdx = raw.findIndex(row => isHeaderRow(row))

  // Fallback 1: first row with ≥2 all-string non-null cells
  if (headerRowIdx < 0) {
    headerRowIdx = raw.findIndex(row => {
      const nonNull = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '')
      return nonNull.length >= 2 && nonNull.every(c => typeof c === 'string')
    })
  }

  // Fallback 2: any non-empty row
  if (headerRowIdx < 0) {
    headerRowIdx = raw.findIndex(row =>
      row.some(c => c !== null && c !== undefined && String(c).trim() !== ''),
    )
  }

  if (headerRowIdx < 0) return { sheets, sheetIndex: targetSheet, headers: [], rows: [] }

  const headers = (raw[headerRowIdx] as (string | null)[]).map(h =>
    h !== null && h !== undefined ? String(h).trim() : null,
  )
  const rows = raw.slice(headerRowIdx + 1) as (string | number | boolean | null)[][]

  return { sheets, sheetIndex: targetSheet, headers, rows }
}

// ── Auto-detect employee code column ─────────────────────────────────────────────

export function autoDetect(headers: (string | null)[]): DetectedColumns {
  const detected: DetectedColumns = {}
  for (const header of headers) {
    if (!header || detected.employee_code) continue
    const h = normalize(header)
    if (EMP_KEYWORDS.some(kw => h.includes(normalize(kw)))) {
      detected.employee_code = header
    }
  }
  return detected
}

// ── Transforms ───────────────────────────────────────────────────────────────────

export function applyTransform(raw: string | number | boolean | null, transform: TransformType): string {
  const str = raw === null || raw === undefined ? '' : String(raw).trim()

  switch (transform) {
    case 'padLeft6': {
      const digits = str.replace(/\D/g, '')
      return digits ? digits.padStart(6, '0') : str
    }

    case 'hoursToDecimal': {
      // "11hs 58min" | "10h30min" | "596h51min" | "10:30"
      const hMin = str.match(/(\d+)\s*hs?\s*(\d+)?\s*min?/i)
      if (hMin) {
        const h = parseInt(hMin[1], 10)
        const m = hMin[2] ? parseInt(hMin[2], 10) : 0
        return (h + m / 60).toFixed(2).replace('.', ',')
      }
      const col = str.match(/^(\d+):(\d{2})$/)
      if (col) {
        return (parseInt(col[1], 10) + parseInt(col[2], 10) / 60).toFixed(2).replace('.', ',')
      }
      return str
    }

    case 'numberBR': {
      if (typeof raw === 'number') {
        return raw.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      const cleaned = str.replace(/\.(?=\d{3})/g, '').replace(',', '.')
      const num = parseFloat(cleaned)
      if (!isNaN(num)) {
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      return str
    }

    case 'direct':
    default:
      return str
  }
}

// ── Apply one sheet rule (wide → long pivot) ─────────────────────────────────────

function applySheetRule(
  sheetRule: SheetRule,
  rows: (string | number | boolean | null)[][],
  headers: (string | null)[],
): OutputRow[] {
  const idx: Record<string, number> = {}
  headers.forEach((h, i) => { if (h) idx[h] = i })

  const empIdx = idx[sheetRule.employee_code_column]
  if (empIdx === undefined) return []

  const results: OutputRow[] = []

  for (const row of rows) {
    if (row.every(c => c === null || c === '' || c === undefined)) continue

    const rawEmp = row[empIdx]
    if (rawEmp === null || rawEmp === undefined || String(rawEmp).trim() === '') continue

    const employee_code = applyTransform(rawEmp, sheetRule.employee_code_transform)
    if (!employee_code) continue

    for (const event of sheetRule.events) {
      const srcIdx = idx[event.source_column]
      if (srcIdx === undefined) continue

      const rawVal = row[srcIdx] ?? null
      const transformed = applyTransform(rawVal, event.transform)

      if (event.skip_if_zero) {
        if (!transformed) continue
        const n = parseFloat(transformed.replace(/\./g, '').replace(',', '.'))
        if (isNaN(n) || n === 0) continue
      }

      results.push({
        employee_code,
        event_code: event.event_code,
        reference: event.output_field === 'reference' ? transformed : '',
        value: event.output_field === 'value' ? transformed : '',
      })
    }
  }

  return results
}

// ── Process full layout: parse each sheet and merge ───────────────────────────────

export async function processLayout(file: File, config: LayoutConfig): Promise<OutputRow[]> {
  const allRows: OutputRow[] = []

  for (const sheetRule of config.sheets) {
    const parsed = await parseExcel(file, sheetRule.sheet_index)
    const rows = applySheetRule(sheetRule, parsed.rows, parsed.headers)
    allRows.push(...rows)
  }

  return allRows
}

// ── CSV generation ────────────────────────────────────────────────────────────────

function csvCell(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

// Sums only the monetary "value" field. Rows that carry a "reference" only
// (e.g. hora extra rows, where the field holds a decimal hour count, not money)
// are not monetary and must not contribute to the total.
export function totalValue(rows: OutputRow[]): number {
  return rows.reduce((sum, r) => {
    if (!r.value) return sum
    const n = parseFloat(r.value.replace(/\./g, '').replace(',', '.'))
    return sum + (isNaN(n) ? 0 : n)
  }, 0)
}

export function generateCsv(rows: OutputRow[]): string {
  const total = totalValue(rows)
  const totalBR = total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const lines = [
    '01TC0006,,,',
    'Cód.Empregado,Cód. Evento,Referência,Valor do Evento',
    ...rows.map(r =>
      [csvCell(r.employee_code), csvCell(r.event_code), csvCell(r.reference), csvCell(r.value)].join(','),
    ),
    `Z,${rows.length},,${csvCell(totalBR)}`,
  ]

  return lines.join('\r\n')
}

export function downloadCsv(content: string, filename: string): void {
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
