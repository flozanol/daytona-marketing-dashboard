import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dmycblwisuawfxnihmyu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteWNibHdpc3Vhd2Z4bmlobXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDY5NzYsImV4cCI6MjA4ODEyMjk3Nn0.5HismgV6yHFdUU11UkyaVmQ9snhpNlmDM3Jozerkgfk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
