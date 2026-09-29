// Kernel Panic Pinball: the rules and physics, without Blazor or a canvas. Balls, two flippers, a plunger, walls and
// bumpers that are syscalls. fork() sometimes splits your ball in two. Losing your last ball is a kernel panic.
// Deterministic from a seed, so the tests can play it.

namespace Pinball.Core;

public record struct Vec(double X, double Y)
{
    public static Vec operator +(Vec a, Vec b) => new(a.X + b.X, a.Y + b.Y);
    public static Vec operator -(Vec a, Vec b) => new(a.X - b.X, a.Y - b.Y);
    public static Vec operator *(Vec a, double k) => new(a.X * k, a.Y * k);
    public double Dot(Vec b) => X * b.X + Y * b.Y;
    public double Length => Math.Sqrt(X * X + Y * Y);
    public Vec Normalized() => Length > 1e-9 ? this * (1 / Length) : new Vec(0, -1);
    public override string ToString() => $"({X:0.0}, {Y:0.0})";
}

public sealed class Ball
{
    public Vec Pos;
    public Vec Vel;
    public bool InPlunger;
}

public sealed class Bumper(string name, Vec pos, double radius, int points)
{
    public string Name { get; } = name;
    public Vec Pos { get; } = pos;
    public double Radius { get; } = radius;
    public int Points { get; } = points;
    /// <summary>Seconds left of the lit-up flash after a hit, for drawing.</summary>
    public double Flash;
}

public sealed class Flipper(Vec pivot, double length, double restAngle, double upAngle)
{
    public Vec Pivot { get; } = pivot;
    public double Length { get; } = length;
    public double RestAngle { get; } = restAngle;
    public double UpAngle { get; } = upAngle;
    public double Angle = restAngle;
    public double AngularVelocity;
    public bool Pressed;
    public Vec Tip => Pivot + new Vec(Math.Cos(Angle), Math.Sin(Angle)) * Length;
}

public enum Phase { Ready, Playing, Panic, Over }

public sealed class Table
{
    public const double Width = 300;
    public const double Height = 520;
    public const double BallRadius = 7;
    public const double Gravity = 520;
    public const int StartBalls = 3;
    /// <summary>At most this many balls at once: fork() is not a fork bomb.</summary>
    public const int MaxBalls = 3;

    public List<Ball> Balls { get; } = [];
    public List<Bumper> Bumpers { get; } = [];
    public List<(Vec A, Vec B)> Walls { get; } = [];
    public Flipper Left { get; }
    public Flipper Right { get; }
    public Phase Phase { get; private set; } = Phase.Ready;
    public int Score { get; private set; }
    public int BallsLeft { get; private set; } = StartBalls;
    /// <summary>How long the plunger has been pulled, 0..1.</summary>
    public double Plunger { get; private set; }
    public bool Pulling { get; set; }
    /// <summary>What just happened, for the page: "fork", "bumper:read()", "panic", …</summary>
    public List<string> Events { get; } = [];

    private uint _rng;

    public Table(uint seed = 1)
    {
        _rng = seed == 0 ? 1u : seed;
        // the outline: a rounded top, walls down to the flippers, and the plunger lane on the right
        var top = new List<Vec>();
        for (var i = 0; i <= 12; i++)
        {
            var a = Math.PI + Math.PI * i / 12;
            top.Add(new Vec(150 + Math.Cos(a) * 140, 150 + Math.Sin(a) * 140));
        }
        for (var i = 0; i < top.Count - 1; i++) Walls.Add((top[i], top[i + 1]));
        Walls.Add((new Vec(10, 150), new Vec(10, 430)));   // left wall
        Walls.Add((new Vec(10, 430), new Vec(88, 478)));   // left slope to the flipper
        Walls.Add((new Vec(262, 150), new Vec(262, 430))); // right wall (the plunger lane is to its right)
        Walls.Add((new Vec(262, 430), new Vec(212, 478))); // right slope to the flipper
        Walls.Add((new Vec(290, 150), new Vec(290, Height))); // outer wall of the plunger lane
        // a guide at the top of the lane, so a launched ball curls into the table
        Walls.Add((new Vec(290, 120), new Vec(250, 40)));

        Bumpers.Add(new Bumper("read()", new Vec(95, 150), 20, 100));
        Bumpers.Add(new Bumper("write()", new Vec(185, 140), 20, 100));
        Bumpers.Add(new Bumper("exec()", new Vec(140, 230), 18, 250));
        Bumpers.Add(new Bumper("fork()", new Vec(70, 300), 16, 500));
        Bumpers.Add(new Bumper("kill -9", new Vec(215, 300), 14, 750));

        Left = new Flipper(new Vec(88, 478), 52, 0.45, -0.5);
        Right = new Flipper(new Vec(212, 478), 52, Math.PI - 0.45, Math.PI + 0.5);
    }

    private double Random()
    {
        _rng ^= _rng << 13;
        _rng ^= _rng >> 17;
        _rng ^= _rng << 5;
        return _rng / 4294967296.0;
    }

    /// <summary>Puts a ball in the plunger lane.</summary>
    public void Serve()
    {
        Balls.Clear();
        Balls.Add(new Ball { Pos = new Vec(276, 480), InPlunger = true });
        Phase = Phase.Playing;
        Plunger = 0;
    }

    public void Start()
    {
        Score = 0;
        BallsLeft = StartBalls;
        Serve();
    }

    public void Step(double dt)
    {
        Events.Clear();
        foreach (var b in Bumpers) b.Flash = Math.Max(0, b.Flash - dt);
        if (Phase != Phase.Playing) return;
        const int sub = 8;
        var h = dt / sub;
        // stop as soon as the last ball drains: the rest of this frame must not count the drain again
        for (var s = 0; s < sub && Phase == Phase.Playing; s++) SubStep(h);
    }

    private void MoveFlipper(Flipper f, double h, bool left)
    {
        var target = f.Pressed ? f.UpAngle : f.RestAngle;
        var speed = f.Pressed ? 18.0 : 9.0;
        var before = f.Angle;
        var diff = target - f.Angle;
        var step = Math.Clamp(diff, -speed * h, speed * h);
        f.Angle += step;
        f.AngularVelocity = (f.Angle - before) / h;
        _ = left;
    }

    private void SubStep(double h)
    {
        MoveFlipper(Left, h, true);
        MoveFlipper(Right, h, false);

        if (Pulling) Plunger = Math.Min(1, Plunger + h * 1.2);

        foreach (var ball in Balls.ToList())
        {
            if (ball.InPlunger)
            {
                if (!Pulling && Plunger > 0)
                {
                    // let go of the plunger: launch
                    ball.Vel = new Vec(0, -(420 + 520 * Plunger));
                    ball.InPlunger = false;
                    Plunger = 0;
                }
                else
                {
                    ball.Pos = new Vec(276, 480 + Plunger * 20);
                    continue;
                }
            }
            ball.Vel = ball.Vel + new Vec(0, Gravity * h);
            // speed limit, so nothing tunnels through a wall
            if (ball.Vel.Length > 1100) ball.Vel = ball.Vel.Normalized() * 1100;
            ball.Pos = ball.Pos + ball.Vel * h;

            foreach (var (a, b) in Walls) CollideSegment(ball, a, b, 0.55, Vec0);
            foreach (var bumper in Bumpers) CollideBumper(ball, bumper);
            CollideFlipper(ball, Left);
            CollideFlipper(ball, Right);

            if (ball.Pos.Y > Height + 20)
            {
                Balls.Remove(ball);
            }
        }

        if (Balls.Count == 0) Drain();
    }

    private static readonly Vec Vec0 = new(0, 0);

    private static Vec Closest(Vec p, Vec a, Vec b)
    {
        var ab = b - a;
        var len2 = ab.Dot(ab);
        if (len2 < 1e-9) return a;
        var t = Math.Clamp((p - a).Dot(ab) / len2, 0, 1);
        return a + ab * t;
    }

    /// <summary>Bounces a ball off a segment moving with velocity surfaceVel at the contact point.</summary>
    private static bool CollideSegment(Ball ball, Vec a, Vec b, double restitution, Vec surfaceVel)
    {
        var c = Closest(ball.Pos, a, b);
        var d = ball.Pos - c;
        var dist = d.Length;
        if (dist >= BallRadius || dist < 1e-9) return false;
        var n = d * (1 / dist);
        ball.Pos = c + n * BallRadius;
        var rel = ball.Vel - surfaceVel;
        var into = rel.Dot(n);
        if (into < 0) ball.Vel = ball.Vel - n * ((1 + restitution) * into);
        return true;
    }

    private void CollideBumper(Ball ball, Bumper bumper)
    {
        var d = ball.Pos - bumper.Pos;
        var dist = d.Length;
        var min = BallRadius + bumper.Radius;
        if (dist >= min || dist < 1e-9) return;
        var n = d * (1 / dist);
        ball.Pos = bumper.Pos + n * min;
        var into = ball.Vel.Dot(n);
        // bumpers kick: the ball leaves faster than it came in
        ball.Vel = ball.Vel - n * (2 * into) + n * 180;
        if (bumper.Flash <= 0)
        {
            Score += bumper.Points;
            Events.Add("bumper:" + bumper.Name);
            if (bumper.Name == "fork()" && Balls.Count < MaxBalls && Random() < 0.5)
            {
                Balls.Add(new Ball { Pos = ball.Pos, Vel = new Vec(-ball.Vel.X, ball.Vel.Y) });
                Events.Add("fork");
            }
        }
        bumper.Flash = 0.15;
    }

    private void CollideFlipper(Ball ball, Flipper f)
    {
        var c = Closest(ball.Pos, f.Pivot, f.Tip);
        // the flipper's own speed at the contact point pushes the ball
        var r = c - f.Pivot;
        var surface = new Vec(-r.Y, r.X) * f.AngularVelocity;
        CollideSegment(ball, f.Pivot, f.Tip, 0.3, surface);
    }

    private void Drain()
    {
        BallsLeft--;
        Events.Add("panic");
        if (BallsLeft <= 0)
        {
            Phase = Phase.Over;
            return;
        }
        Phase = Phase.Panic;
    }

    /// <summary>After a kernel panic: reboot, with the next ball in the plunger lane.</summary>
    public void Reboot()
    {
        if (Phase == Phase.Panic) Serve();
    }
}
