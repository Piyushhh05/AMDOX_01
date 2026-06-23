'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, AreaChart,
} from 'recharts';
import api from '../../lib/api';
import { fmt, fmtDate } from '../../lib/utils';
import { Brain, TrendingUp, AlertTriangle, Package, RefreshCw, ChevronDown } from 'lucide-react';

export default function ForecastingPage() {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [forecastDays, setForecastDays] = useState(30);

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/api/v1/supply-chain/products'),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['forecast-summary'],
    queryFn: () => api.get('/api/v1/forecasting/summary'),
  });

  const { data: forecast, isLoading: forecastLoading, refetch } = useQuery({
    queryKey: ['forecast-product', selectedProductId, forecastDays],
    queryFn: () => api.get(`/api/v1/forecasting/product/${selectedProductId}?days=${forecastDays}`),
    enabled: !!selectedProductId,
  });

  const productList = (products as any[]) || [];
  const summaryData = (summary as any[]) || [];
  const forecastData = forecast as any;

  const chartData = forecastData?.forecast?.map((f: any) => ({
    date: new Date(f.forecastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    predicted: Number(f.predictedQty),
  })) || [];

  const criticalItems = summaryData.filter((s: any) => s.daysUntilStockout < 14);
  const warningItems = summaryData.filter((s: any) => s.daysUntilStockout >= 14 && s.daysUntilStockout < 30);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            AI Demand Forecasting
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Prophet time-series model · 90-day horizon · Weekly retraining
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg font-medium">
          <Brain className="w-3.5 h-3.5" />
          ML Service Active
        </div>
      </div>

      {/* Alert banners */}
      {criticalItems.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {criticalItems.length} product{criticalItems.length > 1 ? 's' : ''} will stock out within 14 days
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {criticalItems.map((i: any) => i.product.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Products Tracked</p>
          <p className="text-3xl font-bold text-slate-900">{summaryData.length}</p>
          <p className="text-xs text-slate-500 mt-1">With demand forecasts</p>
        </div>
        <div className="card p-5 border-l-4 border-red-400">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Critical (≤14 days)</p>
          <p className="text-3xl font-bold text-red-600">{criticalItems.length}</p>
          <p className="text-xs text-slate-500 mt-1">Immediate reorder needed</p>
        </div>
        <div className="card p-5 border-l-4 border-yellow-400">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Warning (14-30 days)</p>
          <p className="text-3xl font-bold text-yellow-600">{warningItems.length}</p>
          <p className="text-xs text-slate-500 mt-1">Plan reorder soon</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Forecast Chart - left 2/3 */}
        <div className="xl:col-span-2 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3>Demand Forecast Chart</h3>
            <div className="flex items-center gap-2">
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="input text-sm w-48"
              >
                <option value="">Select a product</option>
                {productList.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <select
                value={forecastDays}
                onChange={e => setForecastDays(Number(e.target.value))}
                className="input text-sm w-28"
              >
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
              {selectedProductId && (
                <button
                  onClick={() => refetch()}
                  className="btn-secondary p-2"
                  title="Refresh forecast"
                >
                  <RefreshCw className={`w-4 h-4 ${forecastLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {!selectedProductId && (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              <Brain className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">Select a product to view its forecast</p>
              <p className="text-sm mt-1">AI will predict demand for the selected horizon</p>
            </div>
          )}

          {selectedProductId && forecastLoading && (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              <Brain className="w-10 h-10 mb-3 opacity-60 animate-pulse" />
              <p className="text-sm font-medium animate-pulse">Running Prophet model...</p>
            </div>
          )}

          {selectedProductId && !forecastLoading && chartData.length > 0 && (
            <>
              {/* Product info strip */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold">{forecastData?.product?.name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{forecastData?.product?.sku}</span>
                </div>
                {forecastData?.modelUsed && (
                  <span className="badge-blue ml-auto">
                    Model: {forecastData.modelUsed}
                  </span>
                )}
                {forecastData?.mape !== null && forecastData?.mape !== undefined && (
                  <span className="text-xs text-slate-500">MAPE: {forecastData.mape}%</span>
                )}
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.floor(chartData.length / 6)}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v} units`}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${v} units`, 'Predicted Demand']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    name="Predicted Demand"
                    stroke="#3b82f6"
                    fill="url(#forecastGrad)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <p className="text-xs text-slate-400 mt-3 text-center">
                Showing {forecastDays}-day demand forecast · Generated {forecastData?.generatedAt ? fmtDate(forecastData.generatedAt) : 'just now'} · Source: {forecastData?.source || 'ml_service'}
              </p>
            </>
          )}
        </div>

        {/* Reorder Recommendations - right 1/3 */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3>Reorder Recommendations</h3>
            <p className="text-xs text-slate-400 mt-0.5">Based on AI demand predictions</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {summaryLoading && [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-20" />
              </div>
            ))}
            {!summaryLoading && summaryData.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No forecast data yet.</p>
                <p className="text-xs mt-1">Select a product above to generate forecasts.</p>
              </div>
            )}
            {summaryData.map((item: any) => {
              const urgency = item.daysUntilStockout < 14 ? 'critical' :
                item.daysUntilStockout < 30 ? 'warning' : 'ok';
              const colors = {
                critical: { dot: 'bg-red-500', badge: 'badge-red', text: 'text-red-600' },
                warning: { dot: 'bg-yellow-500', badge: 'badge-yellow', text: 'text-yellow-600' },
                ok: { dot: 'bg-green-500', badge: 'badge-green', text: 'text-green-600' },
              }[urgency];

              return (
                <div
                  key={item.product.id}
                  onClick={() => setSelectedProductId(item.product.id)}
                  className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${colors.dot}`} />
                      <p className="text-sm font-semibold text-slate-800 leading-tight">
                        {item.product.name}
                      </p>
                    </div>
                    {item.reorderRecommended && (
                      <span className={`${colors.badge} flex-shrink-0 text-xs`}>Reorder</span>
                    )}
                  </div>
                  <div className="ml-4 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Current stock</span>
                      <span className="font-medium">{item.currentStock} units</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Avg daily demand</span>
                      <span className="font-medium">{item.avgDailyDemand} units/day</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Days until stockout</span>
                      <span className={`font-bold ${colors.text}`}>
                        {item.daysUntilStockout >= 999 ? '∞' : `${item.daysUntilStockout}d`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="card p-5">
        <h3 className="mb-3">How the AI Model Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            { icon: '📊', title: 'Data Input', desc: 'Historical purchase order data is collected and grouped by date to form a time-series dataset per SKU.' },
            { icon: '🧠', title: 'Prophet Model', desc: 'Facebook\'s Prophet algorithm fits seasonality (weekly, yearly) and trend components to predict future demand with confidence intervals.' },
            { icon: '🔄', title: 'Weekly Retraining', desc: 'Every Monday, the model automatically retrains with new data, keeping predictions fresh and accurate. MAPE target < 12%.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div>
                <p className="font-semibold text-slate-800 mb-1">{title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
