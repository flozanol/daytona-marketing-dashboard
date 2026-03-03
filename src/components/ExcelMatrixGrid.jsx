import React, { useState } from 'react'
import { Save, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const SEGMENTS = ['Nuevos', 'Seminuevos', 'PostVenta']
const SOURCES = [
    'Página Web', 'Leads Planta', 'Whatsapp', 'Google',
    'Facebook', 'Instagram', 'Tiktok', 'Mercado Libre',
    'Eventos', 'Teléfono', 'Otros'
]
const ROWS = ['Leads', 'Contactados', 'Citas concretadas', 'Ventas', 'Inversión', 'Utilidad generada']

const ExcelMatrixGrid = ({ onSaved }) => {
    const [mes, setMes] = useState('Marzo')
    const [anio, setAnio] = useState(new Date().getFullYear())
    const [agencia, setAgencia] = useState('Daytona Polanco')
    const [division, setDivision] = useState('Autos')
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    // Data structure: [segment][source][row]
    const getInitialData = () => {
        const initial = {}
        SEGMENTS.forEach(seg => {
            initial[seg] = {}
            SOURCES.forEach(src => {
                initial[seg][src] = {
                    Leads: 0,
                    Contactados: 0,
                    'Citas concretadas': 0,
                    Ventas: 0,
                    Inversión: 0,
                    'Utilidad generada': 0
                }
            })
        })
        return initial
    }

    const [data, setData] = useState(getInitialData)

    // --- Data Fetching ---
    React.useEffect(() => {
        fetchExistingData()
    }, [agencia, division, mes, anio])

    async function fetchExistingData() {
        if (!agencia || !division || !mes || !anio) return

        try {
            setFetching(true)
            const { data: existing, error: fetchError } = await supabase
                .from('marketing_source_metrics')
                .select('*')
                .eq('agencia_nombre', agencia)
                .eq('division', division)
                .eq('mes', mes)
                .eq('anio', anio)

            const newData = getInitialData()

            if (existing && existing.length > 0) {
                existing.forEach(row => {
                    if (newData[row.segmento] && newData[row.segmento][row.fuente]) {
                        newData[row.segmento][row.fuente] = {
                            Leads: row.leads || 0,
                            Contactados: row.contactados || 0,
                            'Citas concretadas': row.citas_concretadas || 0,
                            Ventas: row.ventas || 0,
                            Inversión: row.inversion || 0,
                            'Utilidad generada': row.utilidad || 0
                        }
                    }
                })
            }
            setData(newData)
        } catch (err) {
            console.error('Error fetching matrix data:', err)
        } finally {
            setFetching(false)
        }
    }

    const handleChange = (seg, src, row, val) => {
        setData(prev => ({
            ...prev,
            [seg]: {
                ...prev[seg],
                [src]: {
                    ...prev[seg][src],
                    [row]: parseFloat(val) || 0
                }
            }
        }))
    }

    const handleSave = async () => {
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            // First, delete existing data for this combination to avoid duplicates
            await supabase
                .from('marketing_source_metrics')
                .delete()
                .eq('agencia_nombre', agencia)
                .eq('division', division)
                .eq('mes', mes)
                .eq('anio', anio)

            const rowsToInsert = []
            SEGMENTS.forEach(seg => {
                SOURCES.forEach(src => {
                    const metrics = data[seg][src]
                    // Only insert if there's at least some data
                    if (Object.values(metrics).some(v => v > 0)) {
                        rowsToInsert.push({
                            mes,
                            anio,
                            agencia_nombre: agencia,
                            division,
                            segmento: seg,
                            fuente: src,
                            leads: metrics.Leads,
                            contactados: metrics.Contactados,
                            citas_concretadas: metrics['Citas concretadas'],
                            ventas: metrics.Ventas,
                            inversion: metrics.Inversión,
                            utilidad: metrics['Utilidad generada']
                        })
                    }
                })
            })

            if (rowsToInsert.length === 0) {
                // If it was already cleared, that's fine too
                setSuccess(true)
                return
            }

            const { error: dbError } = await supabase
                .from('marketing_source_metrics')
                .insert(rowsToInsert)

            if (dbError) throw dbError

            setSuccess(true)
            if (onSaved) setTimeout(() => onSaved(), 2000)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="glass p-6 rounded-2xl flex flex-wrap gap-6 items-end">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Agencia</label>
                    <input
                        className="input-field py-2"
                        value={agencia}
                        onChange={e => setAgencia(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">División</label>
                    <select
                        className="input-field py-2"
                        value={division}
                        onChange={e => setDivision(e.target.value)}
                    >
                        <option>Autos</option>
                        <option>Motos</option>
                        <option>Llantas</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Año</label>
                    <select
                        className="input-field py-2"
                        value={anio}
                        onChange={e => setAnio(parseInt(e.target.value))}
                    >
                        {[2023, 2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Mes</label>
                    <select
                        className="input-field py-2"
                        value={mes}
                        onChange={e => setMes(e.target.value)}
                    >
                        {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map(m => (
                            <option key={m}>{m}</option>
                        ))}
                    </select>
                </div>
                {fetching && (
                    <div className="mb-2 text-primary animate-pulse text-xs font-bold uppercase tracking-widest">
                        Cargando datos...
                    </div>
                )}
            </div>

            <div className="overflow-x-auto glass rounded-2xl border-white/5">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-900/80">
                            <th className="p-4 border border-white/5 text-xs font-bold text-slate-500 uppercase sticky left-0 z-20 bg-slate-900">Segmento</th>
                            <th className="p-4 border border-white/5 text-xs font-bold text-slate-500 uppercase">Métrica</th>
                            {SOURCES.map(src => (
                                <th key={src} className="p-4 border border-white/5 text-xs font-bold text-slate-300 uppercase min-w-[120px]">{src}</th>
                            ))}
                            <th className="p-4 border border-white/5 text-xs font-bold text-primary uppercase bg-primary/5">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SEGMENTS.map(seg => (
                            <React.Fragment key={seg}>
                                {ROWS.map((row, rowIndex) => (
                                    <tr key={`${seg}-${row}`} className="group hover:bg-white/[0.02]">
                                        {rowIndex === 0 && (
                                            <td
                                                rowSpan={ROWS.length}
                                                className="p-4 border border-white/5 font-bold text-secondary bg-slate-900/40 sticky left-0 z-10"
                                            >
                                                {seg}
                                            </td>
                                        )}
                                        <td className="p-3 border border-white/5 text-sm text-slate-400 font-medium whitespace-nowrap">
                                            {row}
                                        </td>
                                        {SOURCES.map(src => (
                                            <td key={src} className="p-1 border border-white/5">
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent border-none text-right p-2 focus:bg-primary/10 transition-colors outline-none text-sm text-white"
                                                    value={data[seg][src][row] || ''}
                                                    onChange={e => handleChange(seg, src, row, e.target.value)}
                                                />
                                            </td>
                                        ))}
                                        <td className="p-3 border border-white/5 text-right font-bold text-primary bg-primary/5">
                                            {row.includes('Inversión') || row.includes('Utilidad')
                                                ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(SOURCES.reduce((acc, src) => acc + (data[seg][src][row] || 0), 0))
                                                : SOURCES.reduce((acc, src) => acc + (data[seg][src][row] || 0), 0)
                                            }
                                        </td>
                                    </tr>
                                ))}
                                {/* Separator row */}
                                <tr className="h-4 bg-slate-900">
                                    <td colSpan={SOURCES.length + 3} className="border-y border-white/10"></td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-900 font-bold">
                        {ROWS.map(row => (
                            <tr key={`total-${row}`}>
                                <td colSpan={2} className="p-4 border border-white/5 uppercase text-xs text-white">Total General {row}</td>
                                {SOURCES.map(src => (
                                    <td key={src} className="p-3 border border-white/5 text-right text-sm">
                                        {SEGMENTS.reduce((acc, seg) => acc + (data[seg][src][row] || 0), 0)}
                                    </td>
                                ))}
                                <td className="p-3 border border-white/5 text-right bg-primary text-white">
                                    {row.includes('Inversión') || row.includes('Utilidad')
                                        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(SEGMENTS.reduce((acc, seg) => acc + SOURCES.reduce((a, s) => a + (data[seg][s][row] || 0), 0), 0))
                                        : SEGMENTS.reduce((acc, seg) => acc + SOURCES.reduce((a, s) => a + (data[seg][s][row] || 0), 0), 0)
                                    }
                                </td>
                            </tr>
                        ))}
                    </tfoot>
                </table>
            </div>

            {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-success/10 border border-success/20 text-success p-4 rounded-xl flex items-center gap-3">
                    <CheckCircle2 size={20} />
                    <p className="font-medium">Métricas guardadas exitosamente.</p>
                </div>
            )}

            <div className="flex justify-between items-center glass p-6 rounded-2xl">
                <div className="flex items-center gap-3 text-slate-500">
                    <Info size={18} />
                    <p className="text-sm italic">Esta matriz replica exactamente el formato de Excel para facilitar la carga mensual.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="btn-primary py-3 px-10 rounded-xl font-bold text-lg disabled:opacity-50 flex items-center gap-3"
                >
                    {loading ? 'Sincronizando...' : <><Save size={20} /> Guardar Matriz Detallada</>}
                </button>
            </div>
        </div>
    )
}

export default ExcelMatrixGrid
