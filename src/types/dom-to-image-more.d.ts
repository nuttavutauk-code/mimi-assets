declare module "dom-to-image-more" {
    interface Options {
        quality?: number;
        bgcolor?: string;
        style?: Record<string, string>;
        width?: number;
        height?: number;
        filter?: (node: Node) => boolean;
    }

    function toPng(node: Node, options?: Options): Promise<string>;
    function toJpeg(node: Node, options?: Options): Promise<string>;
    function toBlob(node: Node, options?: Options): Promise<Blob>;
    function toSvg(node: Node, options?: Options): Promise<string>;
    function toPixelData(node: Node, options?: Options): Promise<Uint8ClampedArray>;

    export default {
        toPng,
        toJpeg,
        toBlob,
        toSvg,
        toPixelData,
    };
}