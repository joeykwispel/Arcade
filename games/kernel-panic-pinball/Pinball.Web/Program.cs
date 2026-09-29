using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Pinball.Web;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
await builder.Build().RunAsync();
