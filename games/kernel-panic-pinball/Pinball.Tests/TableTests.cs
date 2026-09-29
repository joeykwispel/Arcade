using Pinball.Core;
using Xunit;

namespace Pinball.Tests;

public class TableTests
{
    private static void Run(Table t, double seconds, Action? each = null)
    {
        for (var i = 0; i < seconds * 120; i++)
        {
            each?.Invoke();
            t.Step(1 / 120.0);
        }
    }

    [Fact]
    public void A_new_game_serves_a_ball_into_the_plunger_lane()
    {
        var t = new Table();
        t.Start();
        Assert.Equal(Phase.Playing, t.Phase);
        Assert.Single(t.Balls);
        Assert.True(t.Balls[0].InPlunger);
        Assert.Equal(Table.StartBalls, t.BallsLeft);
    }

    [Fact]
    public void Pulling_and_releasing_the_plunger_launches_the_ball_into_the_table()
    {
        var t = new Table();
        t.Start();
        t.Pulling = true;
        Run(t, 0.8);
        Assert.True(t.Plunger > 0.5);
        t.Pulling = false;
        Run(t, 0.6);
        var ball = t.Balls[0];
        Assert.False(ball.InPlunger);
        // it went up and curled over into the table, left of the lane
        Assert.True(ball.Pos.X < 262, $"ball at {ball.Pos}");
    }

    [Fact]
    public void A_ball_that_nobody_plays_drains_and_panics_the_kernel()
    {
        var t = new Table(3);
        t.Start();
        t.Pulling = true;
        Run(t, 0.5);
        t.Pulling = false;
        Run(t, 30);
        Assert.Contains(t.Phase, new[] { Phase.Panic, Phase.Over });
        Assert.Equal(Table.StartBalls - 1, t.BallsLeft);
        t.Reboot();
        Assert.Equal(Phase.Playing, t.Phase);
        Assert.True(t.Balls[0].InPlunger);
    }

    [Fact]
    public void Three_drains_and_the_game_is_over()
    {
        var t = new Table(5);
        t.Start();
        for (var i = 0; i < Table.StartBalls; i++)
        {
            t.Pulling = true;
            Run(t, 0.4);
            t.Pulling = false;
            Run(t, 40);
            t.Reboot();
        }
        Assert.Equal(Phase.Over, t.Phase);
        Assert.Equal(0, t.BallsLeft);
    }

    [Fact]
    public void Bumpers_score_and_kick_the_ball_away()
    {
        var t = new Table();
        t.Start();
        var bumper = t.Bumpers.First(b => b.Name == "exec()");
        var ball = t.Balls[0];
        ball.InPlunger = false;
        ball.Pos = bumper.Pos + new Vec(0, -(bumper.Radius + Table.BallRadius + 2));
        ball.Vel = new Vec(0, 200);
        t.Step(1 / 60.0);
        Assert.Equal(bumper.Points, t.Score);
        Assert.True(ball.Vel.Y < 0, "kicked back up");
    }

    [Fact]
    public void A_raised_flipper_launches_a_resting_ball()
    {
        var t = new Table();
        t.Start();
        var ball = t.Balls[0];
        ball.InPlunger = false;
        // on the left flipper, a bit out from the pivot
        var p = t.Left.Pivot + new Vec(Math.Cos(t.Left.Angle), Math.Sin(t.Left.Angle)) * 35 + new Vec(0, -Table.BallRadius - 1);
        ball.Pos = p;
        ball.Vel = new Vec(0, 0);
        t.Left.Pressed = true;
        Run(t, 0.1);
        Assert.True(ball.Vel.Y < -300, $"velocity {ball.Vel}");
    }

    [Fact]
    public void Fork_never_makes_more_than_three_balls()
    {
        var t = new Table(7);
        t.Start();
        var fork = t.Bumpers.First(b => b.Name == "fork()");
        for (var i = 0; i < 200; i++)
        {
            var ball = t.Balls[0];
            ball.InPlunger = false;
            ball.Pos = fork.Pos + new Vec(0, -(fork.Radius + Table.BallRadius + 1));
            ball.Vel = new Vec(10, 300);
            fork.Flash = 0;
            t.Step(1 / 60.0);
            Assert.True(t.Balls.Count <= Table.MaxBalls);
        }
        Assert.Equal(Table.MaxBalls, t.Balls.Count);
    }
}
