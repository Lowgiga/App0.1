package de.lowgiga.cuear;
/** Optional decoration only; never used for node locations or picking. */
final class HologramMotion {
    private static final long PERIOD_NANOS=6000000000L;
    private boolean started;
    private long start;
    synchronized float sample(boolean allowed,long nowNanos){
        if(!allowed){reset();return 1f;}
        if(!started || nowNanos<start){started=true;start=nowNanos;return 1f;}
        long elapsed=nowNanos-start;
        if(elapsed<0){start=nowNanos;return 1f;}
        double phase=(elapsed%PERIOD_NANOS)/(double)PERIOD_NANOS;
        return 1f+.035f*(float)Math.sin(phase*2*Math.PI);
    }
    synchronized void reset(){started=false;}
}
