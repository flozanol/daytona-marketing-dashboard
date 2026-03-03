import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Filter, ChevronRight, FileSpreadsheet, Calendar, Building2 } from 'lucide-react'
import { motion } from 'framer-motion'

const MatrixBrowser = ({ onViewDetail }) => {
    const [matrices, setMatrices] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchMatrices()
    }, [])

    async function fetchMatrices() {
        try {
            setLoading(true)
            // Get unique combinations of agency, division, month, year
            const { data, error } = await supabase
                .from('marketing_source_metrics')
                .select('agencia_nombre, division, mes, anio')

            if (error) throw error

            // Grouping manually because Supabase select(distinct) can be tricky with multiple columns
            const uniqueEntries = []
            const seen = new Set()

            data?.forEach(item => {
                const key = `${item.agencia_nombre}|${item.division}|${item.mes}|${item.anio}`
                if (!seen.has(key)) {
                    seen.add(key)
                    uniqueEntries.push(item)
                }
            })

            // Sort by year desc, then month (manual ordering needed for months)
            const monthOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
            uniqueEntries.sort((a, b) => {
                if (b.anio !== a.anio) return b.anio - a.anio
                return monthOrder.indexOf(b.mes) - monthOrder.indexOf(a.mes)
            })

            setMatrices(uniqueEntries)
        } catch (error) {
            console.error('Error fetching matrices list:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredMatrices = matrices.filter(m =>
        m.agencia_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.division.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.mes.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-100">
                        <FileSpreadsheet className="text-primary" size={28} />
                        Historial de Matrices Excel
                    </h2>
                    <p className="text-slate-400 text-sm">Explora y consulta los reportes detallados cargados por las agencias.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar agencia, mes..."
                        className="input-field pl-10 py-2 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="glass p-6 rounded-2xl animate-pulse">
                            <div className="h-4 bg-slate-800 rounded w-3/4 mb-4"></div>
                            <div className="h-3 bg-slate-800 rounded w-1/2 mb-2"></div>
                            <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                        </div>
                    ))}
                </div>
            ) : filteredMatrices.length === 0 ? (
                <div className="glass p-12 rounded-2xl text-center">
                    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet className="text-slate-600" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-300">No se encontraron matrices</h3>
                    <p className="text-slate-500 mt-2">Intenta con otro término o comienza a cargar matrices en esta sección.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMatrices.map((matrix, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="glass p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FileSpreadsheet size={64} />
                            </div>

                            <div className="flex flex-col h-full space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
                                        <Building2 size={12} />
                                        {matrix.division}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-primary transition-colors">{matrix.agencia_nombre}</h3>
                                </div>

                                <div className="flex items-center gap-4 text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={16} className="text-slate-500" />
                                        <span className="text-sm font-medium">{matrix.mes} {matrix.anio}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onViewDetail(matrix)}
                                    className="w-full mt-2 bg-slate-900 hover:bg-primary text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all transition-colors"
                                >
                                    Ver Detalle Matriz
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default MatrixBrowser
