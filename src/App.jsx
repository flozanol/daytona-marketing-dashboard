import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabase'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, ComposedChart, Cell,
    FunnelChart as ReFunnelChart, Funnel, LabelList
} from 'recharts'
import {
    LayoutDashboard, PlusCircle, Trophy, TrendingUp, Users, Target,
    ChevronRight, Filter, Search, Instagram, Facebook, Star,
    ArrowUpRight, ArrowDownRight, Briefcase, Bike, ShoppingBag
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ExcelMatrixGrid from './components/ExcelMatrixGrid'
import MatrixBrowser from './components/MatrixBrowser'

// --- Utility Functions ---
const formatCurrency = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val)
const formatNumber = (val) => new Intl.NumberFormat('es-MX').format(val)
const formatPercent = (val) => `${val.toFixed(1)}%`

const DIVISIONS = ['Todos', 'Autos', 'Motos', 'Llantas']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const SECTIONS = {
    DASHBOARD: 'dashboard',
    ENTRY: 'entry',
    RANKING: 'ranking',
    GRANULAR: 'granular'
}

function App() {
    const [activeSection, setActiveSection] = useState(SECTIONS.DASHBOARD)
    const [metrics, setMetrics] = useState([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ division: 'Todos', mes: 'Todos', agencia: 'Todos', anio: 'Todos' })
    const [submitting, setSubmitting] = useState(false)
    const [selectedMatrix, setSelectedMatrix] = useState(null)
    const [viewMode, setViewMode] = useState('detail') // Default to detail for easy upload

    // --- Data Fetching ---
    useEffect(() => {
        fetchMetrics()
    }, [])

    async function fetchMetrics() {
        try {
            setLoading(true)

            // Fetch from simple table
            const { data: simpleData, error: simpleError } = await supabase
                .from('marketing_metrics')
                .select('*')
                .order('anio', { ascending: false })

            if (simpleError) throw simpleError

            // Fetch from granular table (handle case where it might not exist yet)
            let granularData = []
            try {
                const { data: gData, error: gError } = await supabase
                    .from('marketing_source_metrics')
                    .select('*')

                if (!gError) granularData = gData
            } catch (e) {
                console.warn('Granular table not found or accessible')
            }

            // Deduplicate: Keep only the latest record for each key (agency, month, year, division, [segment for granular])
            const deduplicatedMap = new Map()

            // Process granular data first
            granularData.forEach(d => {
                const agency = d.agencia_nombre?.trim() || ''
                const key = `${agency}-${d.mes}-${d.anio}-${d.division}-${d.segmento}-${d.fuente}`
                // Only keep if newer (assuming higher ID or just replace)
                if (!deduplicatedMap.has(key) || d.id > deduplicatedMap.get(key).id) {
                    deduplicatedMap.set(key, {
                        ...d,
                        agencia_nombre: agency,
                        type: 'granular',
                        inv_total: (d.inversion || 0),
                        leads_totales: d.leads,
                        ventas_cerradas: d.ventas,
                        citas_agendadas: d.citas_concretadas
                    })
                }
            })

            // Process simple data
            simpleData.forEach(d => {
                const agency = d.agencia_nombre?.trim() || ''
                const key = `${agency}-${d.mes}-${d.anio}-${d.division}`
                const simpleKey = `simple-${key}`

                if (!deduplicatedMap.has(simpleKey) || d.id > deduplicatedMap.get(simpleKey).id) {
                    deduplicatedMap.set(simpleKey, {
                        ...d,
                        agencia_nombre: agency,
                        type: 'simple',
                        isRedundant: granularKeys.has(key)
                    })
                }
            })

            setMetrics(Array.from(deduplicatedMap.values()))
        } catch (error) {
            console.error('Error fetching metrics:', error)
        } finally {
            setLoading(false)
        }
    }

    // --- BI Logic ---
    const agencies = useMemo(() => {
        const uniqueAgencies = [...new Set(metrics.map(m => m.agencia_nombre))].filter(Boolean).sort()
        return ['Todos', ...uniqueAgencies]
    }, [metrics])

    const years = useMemo(() => {
        const uniqueYears = [...new Set(metrics.map(m => m.anio))].filter(Boolean).sort((a, b) => b - a)
        return ['Todos', ...uniqueYears]
    }, [metrics])

    const filteredMetrics = useMemo(() => {
        return metrics.filter(m => {
            const matchDivision = filters.division === 'Todos' || m.division === filters.division
            const matchMes = filters.mes === 'Todos' || m.mes === filters.mes
            const matchAgencia = filters.agencia === 'Todos' || m.agencia_nombre === filters.agencia
            const matchAnio = filters.anio === 'Todos' || m.anio === parseInt(filters.anio)
            return matchDivision && matchMes && matchAgencia && matchAnio
        })
    }, [metrics, filters])

    // Metrics for summation: Only non-redundant 'simple' records or 'Nuevos' segment from granular data
    const activeMetricsForSum = useMemo(() => {
        return filteredMetrics.filter(m => {
            if (m.type === 'simple') return !m.isRedundant
            return m.segmento === 'Nuevos'
        })
    }, [filteredMetrics])

    const stats = useMemo(() => {
        if (!activeMetricsForSum.length) return null

        const totalInv = activeMetricsForSum.reduce((acc, m) => {
            if (m.type === 'granular') return acc + (m.inversion || 0)
            return acc + (m.inv_meta || 0) + (m.inv_google || 0) + (m.inv_otros || 0)
        }, 0)

        const totalLeads = activeMetricsForSum.reduce((acc, m) => acc + (m.leads_totales || 0), 0)
        const totalVentas = activeMetricsForSum.reduce((acc, m) => acc + (m.ventas_cerradas || 0), 0)
        const totalCitas = activeMetricsForSum.reduce((acc, m) => acc + (m.citas_agendadas || 0), 0)

        const cpl = totalLeads > 0 ? totalInv / totalLeads : 0
        const conversion = totalLeads > 0 ? (totalVentas / totalLeads) * 100 : 0

        // Proyección de utilidad real si está disponible en granular, si no asume 50k
        const totalUtilidad = activeMetricsForSum.reduce((acc, m) => {
            if (m.type === 'granular') return acc + (m.utilidad || 0)
            return acc + (m.ventas_cerradas * 50000)
        }, 0)

        const roi = totalInv > 0 ? (totalUtilidad / totalInv) * 100 : 0

        // Social Metrics (Latest snapshot for each agency in the current filter)
        const agencyLatest = {}
        filteredMetrics.forEach(m => {
            const timeVal = (m.anio || 0) * 12 + MONTHS.indexOf(m.mes || '')
            // Social metrics are mostly in 'simple' records. Prefer those.
            if (!agencyLatest[m.agencia_nombre] || timeVal > agencyLatest[m.agencia_nombre].time || (timeVal === agencyLatest[m.agencia_nombre].time && m.type === 'simple')) {
                // If it's a simple record OR it has some social data (to be safe)
                if (m.type === 'simple' || m.google_rating) {
                    agencyLatest[m.agencia_nombre] = {
                        time: timeVal,
                        reviews: m.google_reviews || 0,
                        rating: m.google_rating || 0,
                        fb: m.fb_followers || 0,
                        ig: m.ig_followers || 0,
                        tiktok: m.tiktok_followers || 0,
                        isSimple: m.type === 'simple'
                    }
                }
            }
        })

        const totalReviews = Object.values(agencyLatest).reduce((acc, a) => acc + a.reviews, 0)
        const totalFb = Object.values(agencyLatest).reduce((acc, a) => acc + a.fb, 0)
        const totalIg = Object.values(agencyLatest).reduce((acc, a) => acc + a.ig, 0)
        const totalTiktok = Object.values(agencyLatest).reduce((acc, a) => acc + a.tiktok, 0)

        const ratingsWithWeights = Object.values(agencyLatest).filter(a => a.rating > 0)
        const avgRating = ratingsWithWeights.length > 0
            ? ratingsWithWeights.reduce((acc, a) => acc + a.rating, 0) / ratingsWithWeights.length
            : 0

        return { totalInv, totalLeads, totalVentas, totalCitas, cpl, conversion, roi, totalReviews, totalFb, totalIg, totalTiktok, avgRating }
    }, [filteredMetrics])

    // --- Components ---
    const NavItem = ({ section, icon: Icon, label }) => (
        <button
            onClick={() => setActiveSection(section)}
            className={`btn ${activeSection === section ? 'bg-primary text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
            <Icon size={20} />
            <span>{label}</span>
            {activeSection === section && <motion.div layoutId="nav-pill" className="absolute inset-0 bg-primary -z-10 rounded-lg shadow-lg shadow-primary/30" />}
        </button>
    )

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header / Nav */}
            <header className="sticky top-0 z-50 glass border-b border-white/5 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/40">
                        <TrendingUp className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl tracking-tight">GRUPO DAYTONA</h1>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Marketing Intelligence</p>
                    </div>
                </div>

                <nav className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 gap-1">
                    <NavItem section={SECTIONS.DASHBOARD} icon={LayoutDashboard} label="Dashboard Ejecutivo" />
                    <NavItem section={SECTIONS.RANKING} icon={Trophy} label="Ranking Agencias" />
                    <NavItem section={SECTIONS.ENTRY} icon={PlusCircle} label="Carga Simple" />
                    <NavItem section={SECTIONS.GRANULAR} icon={ShoppingBag} label="Matriz Excel" />
                </nav>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                        <Filter size={14} className="text-slate-500" />
                        <select
                            className="bg-transparent text-sm outline-none border-none cursor-pointer"
                            value={filters.division}
                            onChange={(e) => setFilters(prev => ({ ...prev, division: e.target.value }))}
                        >
                            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                        <Filter size={14} className="text-slate-500" />
                        <select
                            className="bg-transparent text-sm outline-none border-none cursor-pointer"
                            value={filters.agencia}
                            onChange={(e) => setFilters(prev => ({ ...prev, agencia: e.target.value }))}
                        >
                            <option value="Todos">Agencia: Todas</option>
                            {agencies.filter(a => a !== 'Todos').map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                        <select
                            className="bg-transparent text-sm outline-none border-none cursor-pointer"
                            value={filters.anio}
                            onChange={(e) => setFilters(prev => ({ ...prev, anio: e.target.value }))}
                        >
                            <option value="Todos">Año: Todos</option>
                            {years.filter(y => y !== 'Todos').map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                        <select
                            className="bg-transparent text-sm outline-none border-none cursor-pointer"
                            value={filters.mes}
                            onChange={(e) => setFilters(prev => ({ ...prev, mes: e.target.value }))}
                        >
                            <option value="Todos">Mes: Todos</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
                <AnimatePresence mode="wait">
                    {activeSection === SECTIONS.DASHBOARD && (
                        <motion.div
                            key="dash"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            {/* Top Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard
                                    label="Inversión Total"
                                    value={formatCurrency(stats?.totalInv || 0)}
                                    trend="+5.2%"
                                    positive={false}
                                    icon={Briefcase}
                                    desc="Meta + Google + Otros"
                                />
                                <StatCard
                                    label="Costo por Lead (CPL)"
                                    value={formatCurrency(stats?.cpl || 0)}
                                    trend="-12.4%"
                                    positive={true}
                                    icon={Target}
                                    desc="Costo promedio por oportunidad"
                                />
                                <StatCard
                                    label="Tasa de Cierre"
                                    value={formatPercent(stats?.conversion || 0)}
                                    trend="+1.8%"
                                    positive={true}
                                    icon={Users}
                                    desc="Relación Leads vs Ventas"
                                />
                                <StatCard
                                    label="ROI Estimado"
                                    value={formatPercent(stats?.roi || 0)}
                                    trend="+24%"
                                    positive={true}
                                    icon={TrendingUp}
                                    desc="Proyección de retorno"
                                />
                            </div>

                            {/* Community Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                                <div className="stat-card flex items-center gap-4 py-4">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                                        <Facebook size={24} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{formatNumber(stats?.totalFb || 0)}</div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">Fans Facebook</div>
                                    </div>
                                </div>
                                <div className="stat-card flex items-center gap-4 py-4">
                                    <div className="w-12 h-12 bg-pink-600/20 rounded-xl flex items-center justify-center text-pink-500">
                                        <Instagram size={24} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{formatNumber(stats?.totalIg || 0)}</div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">Followers Instagram</div>
                                    </div>
                                </div>
                                <div className="stat-card flex items-center gap-4 py-4">
                                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                                        <Star size={24} fill="currentColor" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{stats?.avgRating?.toFixed(1) || '0.0'}</div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">Rating Google</div>
                                    </div>
                                </div>
                                <div className="stat-card flex items-center gap-4 py-4">
                                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                                        <Star size={24} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{formatNumber(stats?.totalReviews || 0)}</div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">Reseñas Google</div>
                                    </div>
                                </div>
                                <div className="stat-card flex items-center gap-4 py-4">
                                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{formatNumber(stats?.totalTiktok || 0)}</div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">Followers TikTok</div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Funnel Chart */}
                                <div className="stat-card">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3>Embudos de Conversión (Funnel)</h3>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Leads {'->'} Citas {'->'} Ventas</div>
                                    </div>
                                    <div className="h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ReFunnelChart>
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }} />
                                                <Funnel
                                                    data={[
                                                        { value: stats?.totalLeads || 0, name: 'Leads', fill: '#6366f1' },
                                                        { value: stats?.totalCitas || 0, name: 'Citas', fill: '#8b5cf6' },
                                                        { value: stats?.totalVentas || 0, name: 'Ventas', fill: '#10b981' }
                                                    ]}
                                                    dataKey="value"
                                                >
                                                    <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="name" />
                                                    <LabelList position="inside" fill="#fff" stroke="none" dataKey="value" />
                                                </Funnel>
                                            </ReFunnelChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Correlation Chart */}
                                <div className="stat-card">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3>Correlación: Rating vs Ventas</h3>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Desempeño de Reputación</div>
                                    </div>
                                    <div className="h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={filteredMetrics}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="agencia_nombre" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis yAxisId="left" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis yAxisId="right" orientation="right" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}
                                                />
                                                <Bar yAxisId="left" dataKey="ventas_cerradas" name="Ventas" radius={[4, 4, 0, 0]}>
                                                    {filteredMetrics.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#38bdf8'} />
                                                    ))}
                                                </Bar>
                                                <Line yAxisId="right" type="monotone" dataKey="google_rating" name="Rating" stroke="#fbbf24" strokeWidth={3} dot={{ r: 4, fill: '#fbbf24' }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeSection === SECTIONS.RANKING && <RankingSection metrics={filteredMetrics} filters={filters} allMetrics={metrics} />}
                    {activeSection === SECTIONS.ENTRY && <EntrySection onSaved={() => { fetchMetrics(); setActiveSection(SECTIONS.DASHBOARD); }} />}
                    {activeSection === SECTIONS.GRANULAR && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {viewMode === 'list' ? (
                                <MatrixBrowser
                                    onViewDetail={(matrix) => {
                                        setSelectedMatrix(matrix)
                                        setViewMode('detail')
                                    }}
                                />
                            ) : (
                                <ExcelMatrixGrid
                                    initialFilters={selectedMatrix}
                                    onBack={selectedMatrix ? () => { setViewMode('list'); setSelectedMatrix(null); } : null}
                                    onShowHistory={() => setViewMode('list')}
                                    onSaved={() => {
                                        fetchMetrics();
                                        setViewMode('detail');
                                        setSelectedMatrix(null);
                                        setActiveSection(SECTIONS.DASHBOARD);
                                    }}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}

// --- Sub-Components ---

function StatCard({ label, value, trend, positive, icon: Icon, desc }) {
    return (
        <div className="stat-card">
            <div className="flex justify-between items-start">
                <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Icon className="text-primary" size={20} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${positive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {trend}
                </div>
            </div>
            <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight">{value}</div>
                <div className="text-sm text-slate-400 mt-1">{label}</div>
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter mt-2">{desc}</p>
            </div>
        </div>
    )
}

function RankingSection({ metrics, filters, allMetrics }) {
    const ranking = useMemo(() => {
        // Group by agency
        const agencies = {}
        metrics.forEach(m => {
            if (!agencies[m.agencia_nombre]) {
                agencies[m.agencia_nombre] = {
                    name: m.agencia_nombre,
                    leads: 0,
                    ventas: 0,
                    inv: 0,
                    rating: 0,
                    reviews: 0,
                    fb: 0,
                    ig: 0,
                    tiktok: 0,
                    latestTime: -1
                }
            }
            const a = agencies[m.agencia_nombre]

            // Only aggregate if segment is 'Nuevos' (for granular) or it's a non-redundant 'simple' record
            if ((m.type === 'simple' && !m.isRedundant) || m.segmento === 'Nuevos') {
                a.leads += m.leads_totales || 0
                a.ventas += m.ventas_cerradas || 0
                if (m.type === 'granular') {
                    a.inv += (m.inversion || 0)
                } else {
                    a.inv += (m.inv_meta + m.inv_google + m.inv_otros) || 0
                }
            }

            // Snapshot metrics: prefer 'simple' records where followers/rating are stored.
            const timeVal = (m.anio || 0) * 12 + MONTHS.indexOf(m.mes || '')
            if (timeVal > a.latestTime || (timeVal === a.latestTime && m.type === 'simple')) {
                a.latestTime = timeVal
                // Only update snapshot if it has valid data (preferring simple for social)
                if (m.type === 'simple' || m.google_rating) {
                    if (m.google_rating !== undefined) a.rating = m.google_rating || 0
                    if (m.google_reviews !== null) a.reviews = m.google_reviews || 0
                    if (m.fb_followers !== undefined) a.fb = m.fb_followers || 0
                    if (m.ig_followers !== undefined) a.ig = m.ig_followers || 0
                    if (m.tiktok_followers !== undefined) a.tiktok = m.tiktok_followers || 0
                }
            }
        })

        return Object.values(agencies)
            .map(a => ({
                ...a,
                cpl: a.leads > 0 ? a.inv / a.leads : 0,
                tasa: a.leads > 0 ? (a.ventas / a.leads) * 100 : 0
            }))
            .sort((a, b) => b.ventas - a.ventas)
    }, [metrics])

    // Data for the monthly breakdown table (Sales per Agency per Month)
    const monthlySales = useMemo(() => {
        // Re-calculate for the filtered year (or all if year is Todos)
        const yearMetrics = allMetrics.filter(m => filters.anio === 'Todos' || m.anio === parseInt(filters.anio))
        const data = {}
        const uniqueAgencies = [...new Set(yearMetrics.map(m => m.agencia_nombre))].filter(Boolean).sort()

        uniqueAgencies.forEach(agn => {
            data[agn] = { name: agn, months: Array(12).fill(0), total: 0 }
            yearMetrics.filter(m => m.agencia_nombre === agn && ((m.type === 'simple' && !m.isRedundant) || m.segmento === 'Nuevos')).forEach(m => {
                const mIdx = MONTHS.indexOf(m.mes)
                if (mIdx !== -1) {
                    data[agn].months[mIdx] += (m.ventas_cerradas || 0)
                    data[agn].total += (m.ventas_cerradas || 0)
                }
            })
        })

        return Object.values(data).sort((a, b) => b.total - a.total)
    }, [allMetrics, filters.anio])

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Trophy className="text-accent" size={32} />
                    <div>
                        <h2 className="text-2xl">Ranking de Rendimiento</h2>
                        <p className="text-slate-500">
                            {filters.mes === 'Todos' ? `Acumulado ${filters.anio === 'Todos' ? 'Histórico' : filters.anio}` : `Vista de ${filters.mes} ${filters.anio}`}
                        </p>
                    </div>
                </div>
                <div className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl">
                    <span className="text-accent font-bold text-sm">Rating y Redes: Dato más reciente</span>
                </div>
            </div>

            {/* Main Ranking Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Posición</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Agencia</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ventas Cerradas</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center"><Facebook size={14} className="inline mr-1" /> FB</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center"><Instagram size={14} className="inline mr-1" /> IG</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">TK</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tasa de Conversión</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">CPL</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Google Rating</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {ranking.map((agency, i) => (
                            <tr key={agency.name} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-accent text-slate-900 shadow-lg shadow-accent/20' : 'bg-slate-800 text-slate-400'}`}>
                                        {i + 1}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-200">{agency.name}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold">{agency.ventas}</span>
                                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${ranking[0].ventas > 0 ? (agency.ventas / ranking[0].ventas) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center text-sm font-medium text-slate-400">{formatNumber(agency.fb)}</td>
                                <td className="px-6 py-4 text-center text-sm font-medium text-slate-400">{formatNumber(agency.ig)}</td>
                                <td className="px-6 py-4 text-center text-sm font-medium text-slate-400">{formatNumber(agency.tiktok)}</td>
                                <td className="px-6 py-4 text-success font-semibold">{formatPercent(agency.tasa)}</td>
                                <td className="px-6 py-4 text-slate-400">{formatCurrency(agency.cpl)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1 text-accent font-bold">
                                        <Star size={14} fill="currentColor" />
                                        {agency.rating.toFixed(1)}
                                        <span className="text-[10px] text-slate-500 ml-1">({formatNumber(agency.reviews)})</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="text-primary" size={20} />
                    <h3 className="text-xl font-bold">Detalle de Ventas Mensuales ({filters.anio === 'Todos' ? 'Histórico' : filters.anio})</h3>
                </div>
                <div className="glass rounded-2xl overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Agencia</th>
                                {MONTHS.map(m => (
                                    <th key={m} className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase text-center">{m.substring(0, 3)}</th>
                                ))}
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-200 uppercase text-center bg-white/5">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {monthlySales.map(agn => (
                                <tr key={agn.name} className="hover:bg-white/[0.01]">
                                    <td className="px-4 py-3 text-sm font-bold text-slate-400">{agn.name}</td>
                                    {agn.months.map((v, i) => (
                                        <td key={i} className={`px-2 py-3 text-center text-sm ${v > 0 ? 'text-white font-medium' : 'text-slate-700'}`}>
                                            {v || '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-center text-sm font-bold bg-white/5 text-primary">{agn.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    )
}

function EntrySection({ onSaved }) {
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({
        mes: MONTHS[new Date().getMonth()],
        anio: new Date().getFullYear(),
        division: 'Autos',
        agencia_nombre: '',
        inv_meta: 0,
        inv_google: 0,
        inv_otros: 0,
        leads_totales: 0,
        citas_agendadas: 0,
        ventas_cerradas: 0,
        google_rating: 4.5,
        google_reviews: 0,
        fb_followers: 0,
        ig_followers: 0,
        tiktok_followers: 0
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { error } = await supabase
                .from('marketing_metrics')
                .upsert([form], {
                    onConflict: 'agencia_nombre,mes,anio,division'
                })
            if (error) throw error
            onSaved()
        } catch (err) {
            console.error('Error saving metrics:', err)
            alert(`Error guardando datos: ${err.message || 'Error desconocido'}`)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto">
            <div className="glass p-8 rounded-3xl border-primary/20 shadow-2xl shadow-primary/5">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold">Carga de Métricas Mensuales</h2>
                    <p className="text-slate-400">Coordinador: Ingrese los KPIs auditados para el cierre de mes.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField label="Mes" type="select" value={form.mes} onChange={v => setForm({ ...form, mes: v })} options={MONTHS} />
                        <FormField label="Año" type="number" value={form.anio} onChange={v => setForm({ ...form, anio: parseInt(v) })} />
                        <FormField label="División" type="select" value={form.division} onChange={v => setForm({ ...form, division: v })} options={['Autos', 'Motos', 'Llantas']} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField label="Nombre de la Agencia" value={form.agencia_nombre} onChange={v => setForm({ ...form, agencia_nombre: v })} placeholder="Ej: Daytona CDMX Central" />
                        <FormField label="Google Rating Actual" type="number" step="0.1" max="5" value={form.google_rating} onChange={v => setForm({ ...form, google_rating: parseFloat(v) })} />
                    </div>

                    <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Inversión Publicitaria</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField label="Meta (FB/IG)" type="number" value={form.inv_meta} onChange={v => setForm({ ...form, inv_meta: parseInt(v) })} />
                            <FormField label="Google Ads" type="number" value={form.inv_google} onChange={v => setForm({ ...form, inv_google: parseInt(v) })} />
                            <FormField label="Otros Canales" type="number" value={form.inv_otros} onChange={v => setForm({ ...form, inv_otros: parseInt(v) })} />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Embudos de Ventas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField label="Leads Totales" type="number" value={form.leads_totales} onChange={v => setForm({ ...form, leads_totales: parseInt(v) })} />
                            <FormField label="Citas Agendadas" type="number" value={form.citas_agendadas} onChange={v => setForm({ ...form, citas_agendadas: parseInt(v) })} />
                            <FormField label="Ventas Cerradas" type="number" value={form.ventas_cerradas} onChange={v => setForm({ ...form, ventas_cerradas: parseInt(v) })} />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Comunidad y Reseñas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField label="Reseñas Google" type="number" value={form.google_reviews} onChange={v => setForm({ ...form, google_reviews: parseInt(v) })} />
                            <FormField label="Followers Facebook" type="number" value={form.fb_followers} onChange={v => setForm({ ...form, fb_followers: parseInt(v) })} />
                            <FormField label="Followers Instagram" type="number" value={form.ig_followers} onChange={v => setForm({ ...form, ig_followers: parseInt(v) })} />
                            <FormField label="Followers TikTok" type="number" value={form.tiktok_followers} onChange={v => setForm({ ...form, tiktok_followers: parseInt(v) })} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button type="submit" disabled={submitting} className="btn-primary px-8 py-3 rounded-xl font-bold text-lg disabled:opacity-50">
                            {submitting ? 'Sincronizando...' : 'Publicar Reporte Mensual'}
                        </button>
                    </div>
                </form>
            </div>
        </motion.div>
    )
}

function FormField({ label, type = 'text', value, onChange, options, ...props }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</label>
            {type === 'select' ? (
                <select
                    className="input-field cursor-pointer"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    type={type}
                    className="input-field"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    {...props}
                />
            )}
        </div>
    )
}

export default App
