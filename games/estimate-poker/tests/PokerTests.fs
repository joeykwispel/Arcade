module PokerTests

open Xunit
open Poker

[<Fact>]
let ``every ticket's true size is on or near a card, and has text in both languages`` () =
    for t in tickets do
        let s = size t
        Assert.True(s >= 1 && s <= 34, $"{t.Title}: {s}")
        Assert.Contains(nearestCard s, deck)
        for c in t.Creep do
            Assert.False(System.String.IsNullOrWhiteSpace c.En)
            Assert.False(System.String.IsNullOrWhiteSpace c.Nl)

[<Fact>]
let ``nearest card rounds to the deck`` () =
    Assert.Equal(1, nearestCard 1)
    Assert.Equal(5, nearestCard 5)
    Assert.Equal(8, nearestCard 7)
    Assert.Equal(21, nearestCard 30)
    Assert.Equal(13, nearestCard 12)

[<Fact>]
let ``scope creeps in over time, and stops when the ticket is complete`` () =
    let t = tickets |> List.find (fun t -> t.Creep.Length = 3)
    Assert.Equal(0, visible t 0.0)
    Assert.Equal(1, visible t creepEvery)
    Assert.Equal(3, visible t 100.0)

[<Fact>]
let ``the right card scores most, and waiting costs points`` () =
    let t = tickets.[2]
    let right = nearestCard (size t)
    let quick = score t right 1.0
    let slow = score t right 10.0
    Assert.True(quick > slow)
    Assert.True(score t right 1.0 > score t 1 1.0)
    Assert.Equal(0, score t 1 60.0)

[<Fact>]
let ``the ticket without scope creep is exactly its base`` () =
    let t = tickets |> List.find (fun t -> t.Creep.IsEmpty)
    Assert.Equal(t.Base, size t)
    Assert.Equal(100, score t (nearestCard t.Base) 0.0)

[<Fact>]
let ``Priya always read the whole ticket`` () =
    for t in tickets do
        let (_, vote, _) = colleagues t |> List.find (fun (n, _, _) -> n = "Priya")
        Assert.Equal(nearestCard (size t), vote)
