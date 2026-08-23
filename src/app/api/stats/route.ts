import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// In-memory fallback if Supabase table is unreachable
let inMemoryVisitorCount = 1;
const recordedSessionIds = new Set<string>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get('track');
  const sessionId = searchParams.get('sessionId');

  // Check if Vercel Analytics API credentials are provided
  const vercelApiToken = process.env.VERCEL_API_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;

  if (vercelApiToken && vercelProjectId) {
    try {
      const from = new URLSearchParams({
        projectId: vercelProjectId,
        environment: 'production',
      });
      const res = await fetch(`https://api.vercel.com/v1/web/analytics/stats?${from.toString()}`, {
        headers: {
          Authorization: `Bearer ${vercelApiToken}`,
        },
      });
      if (res.ok) {
        const vercelData = await res.json();
        if (typeof vercelData.visitors === 'number') {
          return NextResponse.json({
            visitors: vercelData.visitors,
            source: 'vercel_api',
          });
        }
      }
    } catch {
      // Fallback to Supabase
    }
  }

  // Real Database-backed visitor counting in Supabase
  if (supabase) {
    try {
      // 1. If tracking a new unique visit session
      if (track === '1' && sessionId && !recordedSessionIds.has(sessionId)) {
        recordedSessionIds.add(sessionId);

        // Fetch current count
        const { data: currentData } = await supabase
          .from('game_settings')
          .select('value')
          .eq('key', 'total_visitors')
          .maybeSingle();

        const currentVal = currentData?.value ? parseInt(currentData.value, 10) : 0;
        const newVal = currentVal + 1;

        // Save incremented count
        await supabase.from('game_settings').upsert({
          key: 'total_visitors',
          value: newVal.toString(),
          updated_at: new Date().toISOString(),
        });

        return NextResponse.json({
          visitors: newVal,
          source: 'supabase',
        });
      }

      // 2. Read current visitor count
      const { data } = await supabase
        .from('game_settings')
        .select('value')
        .eq('key', 'total_visitors')
        .maybeSingle();

      if (data?.value) {
        const count = parseInt(data.value, 10);
        if (!isNaN(count)) {
          return NextResponse.json({
            visitors: count,
            source: 'supabase',
          });
        }
      }
    } catch {
      // Fallback to in-memory
    }
  }

  // In-memory counter for local development without DB
  if (track === '1' && sessionId && !recordedSessionIds.has(sessionId)) {
    recordedSessionIds.add(sessionId);
    inMemoryVisitorCount += 1;
  }

  return NextResponse.json({
    visitors: inMemoryVisitorCount,
    source: 'local',
  });
}
