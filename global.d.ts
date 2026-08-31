import G = L2JS.Client;
import GR = L2JS.Client.Rendering;
import GD = L2JS.Client.Decoding;

type MakeParams<T> = ConstructorParameters<{ new(): never } & T>;
