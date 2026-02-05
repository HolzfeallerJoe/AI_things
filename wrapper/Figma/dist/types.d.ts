export interface User {
    id: string;
    handle: string;
    img_url: string;
    email?: string;
}
export interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Vector {
    x: number;
    y: number;
}
export interface Transform {
    [key: number]: number[];
}
export interface LayoutConstraint {
    vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
    horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}
export interface ExportSetting {
    suffix: string;
    format: 'JPG' | 'PNG' | 'SVG' | 'PDF';
    constraint: {
        type: 'SCALE' | 'WIDTH' | 'HEIGHT';
        value: number;
    };
}
export type PaintType = 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'EMOJI' | 'VIDEO';
export interface Paint {
    type: PaintType;
    visible?: boolean;
    opacity?: number;
    color?: Color;
    blendMode?: BlendMode;
    gradientHandlePositions?: Vector[];
    gradientStops?: ColorStop[];
    scaleMode?: 'FILL' | 'FIT' | 'TILE' | 'STRETCH';
    imageTransform?: Transform;
    scalingFactor?: number;
    rotation?: number;
    imageRef?: string;
    gifRef?: string;
    filters?: ImageFilters;
}
export interface ColorStop {
    position: number;
    color: Color;
}
export interface ImageFilters {
    exposure?: number;
    contrast?: number;
    saturation?: number;
    temperature?: number;
    tint?: number;
    highlights?: number;
    shadows?: number;
}
export type BlendMode = 'PASS_THROUGH' | 'NORMAL' | 'DARKEN' | 'MULTIPLY' | 'LINEAR_BURN' | 'COLOR_BURN' | 'LIGHTEN' | 'SCREEN' | 'LINEAR_DODGE' | 'COLOR_DODGE' | 'OVERLAY' | 'SOFT_LIGHT' | 'HARD_LIGHT' | 'DIFFERENCE' | 'EXCLUSION' | 'HUE' | 'SATURATION' | 'COLOR' | 'LUMINOSITY';
export type EffectType = 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
export interface Effect {
    type: EffectType;
    visible: boolean;
    radius: number;
    color?: Color;
    blendMode?: BlendMode;
    offset?: Vector;
    spread?: number;
    showShadowBehindNode?: boolean;
}
export interface TypeStyle {
    fontFamily: string;
    fontPostScriptName?: string;
    paragraphSpacing?: number;
    paragraphIndent?: number;
    listSpacing?: number;
    italic?: boolean;
    fontWeight: number;
    fontSize: number;
    textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED';
    textDecoration?: 'NONE' | 'STRIKETHROUGH' | 'UNDERLINE';
    textAutoResize?: 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE';
    textAlignHorizontal?: 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';
    textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
    letterSpacing: number;
    fills?: Paint[];
    hyperlink?: Hyperlink;
    opentypeFlags?: Record<string, number>;
    lineHeightPx?: number;
    lineHeightPercent?: number;
    lineHeightPercentFontSize?: number;
    lineHeightUnit?: 'PIXELS' | 'FONT_SIZE_%' | 'INTRINSIC_%';
}
export interface Hyperlink {
    type: 'URL' | 'NODE';
    url?: string;
    nodeID?: string;
}
export type NodeType = 'DOCUMENT' | 'CANVAS' | 'FRAME' | 'GROUP' | 'SECTION' | 'VECTOR' | 'BOOLEAN_OPERATION' | 'STAR' | 'LINE' | 'ELLIPSE' | 'REGULAR_POLYGON' | 'RECTANGLE' | 'TABLE' | 'TABLE_CELL' | 'TEXT' | 'SLICE' | 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE' | 'STICKY' | 'SHAPE_WITH_TEXT' | 'CONNECTOR' | 'WASHI_TAPE' | 'WIDGET' | 'EMBED' | 'LINK_UNFURL' | 'MEDIA';
export interface BaseNode {
    id: string;
    name: string;
    type: NodeType;
    visible?: boolean;
    pluginData?: Record<string, string>;
    sharedPluginData?: Record<string, Record<string, string>>;
    componentPropertyReferences?: Record<string, string>;
}
export interface DocumentNode extends BaseNode {
    type: 'DOCUMENT';
    children: CanvasNode[];
}
export interface CanvasNode extends BaseNode {
    type: 'CANVAS';
    children: SceneNode[];
    backgroundColor: Color;
    prototypeStartNodeID?: string | null;
    flowStartingPoints?: FlowStartingPoint[];
    prototypeDevice?: PrototypeDevice;
    exportSettings?: ExportSetting[];
}
export interface FlowStartingPoint {
    nodeId: string;
    name: string;
}
export interface PrototypeDevice {
    type: 'NONE' | 'PRESET' | 'CUSTOM' | 'PRESENTATION';
    size?: {
        width: number;
        height: number;
    };
    presetIdentifier?: string;
    rotation?: 'NONE' | 'CCW_90';
}
export type SceneNode = FrameNode | GroupNode | SectionNode | VectorNode | BooleanOperationNode | StarNode | LineNode | EllipseNode | RegularPolygonNode | RectangleNode | TableNode | TextNode | SliceNode | ComponentNode | ComponentSetNode | InstanceNode | StickyNode | ShapeWithTextNode | ConnectorNode | WashiTapeNode | WidgetNode | EmbedNode | LinkUnfurlNode | MediaNode;
export interface FrameBase extends BaseNode {
    children?: SceneNode[];
    locked?: boolean;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
    strokeDashes?: number[];
    cornerRadius?: number;
    rectangleCornerRadii?: [number, number, number, number];
    exportSettings?: ExportSetting[];
    blendMode?: BlendMode;
    preserveRatio?: boolean;
    constraints?: LayoutConstraint;
    layoutAlign?: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX';
    transitionNodeID?: string | null;
    transitionDuration?: number;
    transitionEasing?: EasingType;
    opacity?: number;
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    size?: Vector;
    minWidth?: number | null;
    maxWidth?: number | null;
    minHeight?: number | null;
    maxHeight?: number | null;
    relativeTransform?: Transform;
    clipsContent?: boolean;
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
    primaryAxisSizingMode?: 'FIXED' | 'AUTO';
    counterAxisSizingMode?: 'FIXED' | 'AUTO';
    primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
    counterAxisAlignContent?: 'AUTO' | 'SPACE_BETWEEN';
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    horizontalPadding?: number;
    verticalPadding?: number;
    itemSpacing?: number;
    counterAxisSpacing?: number | null;
    layoutPositioning?: 'AUTO' | 'ABSOLUTE';
    itemReverseZIndex?: boolean;
    strokesIncludedInLayout?: boolean;
    layoutWrap?: 'NO_WRAP' | 'WRAP';
    effects?: Effect[];
    isMask?: boolean;
    isMaskOutline?: boolean;
    styles?: Record<string, string>;
}
export interface FrameNode extends FrameBase {
    type: 'FRAME';
}
export interface GroupNode extends FrameBase {
    type: 'GROUP';
}
export interface SectionNode extends BaseNode {
    type: 'SECTION';
    children?: SceneNode[];
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    sectionContentsHidden?: boolean;
    devStatus?: DevStatus;
}
export interface DevStatus {
    type: 'READY_FOR_DEV' | 'COMPLETED';
    description?: string;
}
export interface VectorBase extends BaseNode {
    locked?: boolean;
    exportSettings?: ExportSetting[];
    blendMode?: BlendMode;
    preserveRatio?: boolean;
    layoutAlign?: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX';
    layoutGrow?: number;
    constraints?: LayoutConstraint;
    transitionNodeID?: string | null;
    transitionDuration?: number;
    transitionEasing?: EasingType;
    opacity?: number;
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    effects?: Effect[];
    size?: Vector;
    relativeTransform?: Transform;
    isMask?: boolean;
    fills?: Paint[];
    fillGeometry?: Path[];
    fillOverrideTable?: Record<number, {
        fills: Paint[];
    }>;
    strokes?: Paint[];
    strokeWeight?: number;
    individualStrokeWeights?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    strokeCap?: 'NONE' | 'ROUND' | 'SQUARE' | 'LINE_ARROW' | 'TRIANGLE_ARROW';
    strokeJoin?: 'MITER' | 'BEVEL' | 'ROUND';
    strokeDashes?: number[];
    strokeMiterAngle?: number;
    strokeGeometry?: Path[];
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
    styles?: Record<string, string>;
}
export interface Path {
    path: string;
    windingRule: 'NONZERO' | 'EVENODD';
    overrideID?: number;
}
export interface VectorNode extends VectorBase {
    type: 'VECTOR';
}
export interface BooleanOperationNode extends VectorBase {
    type: 'BOOLEAN_OPERATION';
    children: SceneNode[];
    booleanOperation: 'UNION' | 'INTERSECT' | 'SUBTRACT' | 'EXCLUDE';
}
export interface StarNode extends VectorBase {
    type: 'STAR';
}
export interface LineNode extends VectorBase {
    type: 'LINE';
}
export interface EllipseNode extends VectorBase {
    type: 'ELLIPSE';
    arcData?: ArcData;
}
export interface ArcData {
    startingAngle: number;
    endingAngle: number;
    innerRadius: number;
}
export interface RegularPolygonNode extends VectorBase {
    type: 'REGULAR_POLYGON';
}
export interface RectangleNode extends VectorBase {
    type: 'RECTANGLE';
    cornerRadius?: number;
    rectangleCornerRadii?: [number, number, number, number];
}
export interface TableNode extends BaseNode {
    type: 'TABLE';
    children?: TableCellNode[];
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    blendMode?: BlendMode;
    effects?: Effect[];
    relativeTransform?: Transform;
    size?: Vector;
}
export interface TableCellNode extends BaseNode {
    type: 'TABLE_CELL';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    fills?: Paint[];
    characters?: string;
    relativeTransform?: Transform;
    size?: Vector;
}
export interface TextNode extends VectorBase {
    type: 'TEXT';
    characters: string;
    style?: TypeStyle;
    characterStyleOverrides?: number[];
    styleOverrideTable?: Record<number, TypeStyle>;
    lineTypes?: ('NONE' | 'ORDERED' | 'UNORDERED')[];
    lineIndentations?: number[];
}
export interface SliceNode extends BaseNode {
    type: 'SLICE';
    exportSettings?: ExportSetting[];
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    size?: Vector;
    relativeTransform?: Transform;
}
export interface ComponentNode extends FrameBase {
    type: 'COMPONENT';
    componentPropertyDefinitions?: Record<string, ComponentPropertyDefinition>;
}
export interface ComponentSetNode extends FrameBase {
    type: 'COMPONENT_SET';
    componentPropertyDefinitions?: Record<string, ComponentPropertyDefinition>;
}
export interface ComponentPropertyDefinition {
    type: 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT' | 'VARIANT';
    defaultValue: boolean | string;
    variantOptions?: string[];
    preferredValues?: InstanceSwapPreferredValue[];
}
export interface InstanceSwapPreferredValue {
    type: 'COMPONENT' | 'COMPONENT_SET';
    key: string;
}
export interface InstanceNode extends FrameBase {
    type: 'INSTANCE';
    componentId: string;
    isExposedInstance?: boolean;
    exposedInstances?: string[];
    componentProperties?: Record<string, ComponentProperty>;
    overrides?: Overrides[];
}
export interface ComponentProperty {
    type: 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT' | 'VARIANT';
    value: boolean | string;
    preferredValues?: InstanceSwapPreferredValue[];
    boundVariables?: Record<string, VariableAlias>;
}
export interface VariableAlias {
    type: 'VARIABLE_ALIAS';
    id: string;
}
export interface Overrides {
    id: string;
    overriddenFields: string[];
}
export interface StickyNode extends BaseNode {
    type: 'STICKY';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    fills?: Paint[];
    characters?: string;
    authorVisible?: boolean;
}
export interface ShapeWithTextNode extends BaseNode {
    type: 'SHAPE_WITH_TEXT';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
    characters?: string;
    shapeType?: 'SQUARE' | 'ELLIPSE' | 'ROUNDED_RECTANGLE' | 'DIAMOND' | 'TRIANGLE_UP' | 'TRIANGLE_DOWN' | 'PARALLELOGRAM_RIGHT' | 'PARALLELOGRAM_LEFT' | 'ENG_DATABASE' | 'ENG_QUEUE' | 'ENG_FILE' | 'ENG_FOLDER';
}
export interface ConnectorNode extends BaseNode {
    type: 'CONNECTOR';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    strokeCap?: string;
    strokeJoin?: string;
    connectorStart?: ConnectorEndpoint;
    connectorEnd?: ConnectorEndpoint;
    connectorStartStrokeCap?: string;
    connectorEndStrokeCap?: string;
    connectorLineType?: 'ELBOWED' | 'STRAIGHT';
    characters?: string;
    textBackground?: ConnectorTextBackground;
}
export interface ConnectorEndpoint {
    endpointNodeId: string;
    position: Vector;
    magnet?: 'AUTO' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
}
export interface ConnectorTextBackground {
    cornerRadius?: number;
    fills?: Paint[];
}
export interface WashiTapeNode extends VectorBase {
    type: 'WASHI_TAPE';
}
export interface WidgetNode extends BaseNode {
    type: 'WIDGET';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
    widgetSyncedState?: Record<string, unknown>;
}
export interface EmbedNode extends BaseNode {
    type: 'EMBED';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
}
export interface LinkUnfurlNode extends BaseNode {
    type: 'LINK_UNFURL';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
}
export interface MediaNode extends BaseNode {
    type: 'MEDIA';
    absoluteBoundingBox?: Rectangle;
    absoluteRenderBounds?: Rectangle | null;
}
export type EasingType = 'EASE_IN' | 'EASE_OUT' | 'EASE_IN_AND_OUT' | 'LINEAR' | 'GENTLE_SPRING' | 'CUSTOM_SPRING' | 'CUSTOM_CUBIC_BEZIER';
export interface FileResponse {
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    lastModified: string;
    editorType: 'figma' | 'figjam';
    thumbnailUrl?: string;
    version: string;
    document: DocumentNode;
    components: Record<string, Component>;
    componentSets: Record<string, ComponentSet>;
    schemaVersion: number;
    styles: Record<string, Style>;
    mainFileKey?: string;
    branches?: Branch[];
}
export interface FileNodesResponse {
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    lastModified: string;
    editorType: 'figma' | 'figjam';
    thumbnailUrl?: string;
    version: string;
    nodes: Record<string, {
        document: SceneNode;
        components: Record<string, Component>;
        schemaVersion: number;
        styles: Record<string, Style>;
    } | null>;
}
export interface FileMetaResponse {
    file: FileMeta;
}
export interface FileMeta {
    key: string;
    name: string;
    thumbnail_url?: string;
    last_modified: string;
    created_at: string;
    version: string;
    role: 'owner' | 'editor' | 'viewer';
    link_access?: 'view' | 'edit' | 'org_view' | 'org_edit' | 'inherit';
    editor_type: 'figma' | 'figjam';
    folder?: boolean;
}
export interface Branch {
    key: string;
    name: string;
    thumbnail_url?: string;
    last_modified: string;
    link_access?: 'view' | 'edit' | 'org_view' | 'org_edit' | 'inherit';
}
export interface FileVersionsResponse {
    versions: FileVersion[];
    pagination?: Pagination;
}
export interface FileVersion {
    id: string;
    created_at: string;
    label?: string;
    description?: string;
    user: User;
    thumbnail_url?: string;
}
export interface ImageResponse {
    err: string | null;
    images: Record<string, string | null>;
}
export interface ImageFillsResponse {
    err: string | null;
    images: Record<string, string>;
}
export type ImageFormat = 'jpg' | 'png' | 'svg' | 'pdf';
export interface GetImageParams {
    ids: string[];
    scale?: number;
    format?: ImageFormat;
    svg_outline_text?: boolean;
    svg_include_id?: boolean;
    svg_include_node_id?: boolean;
    svg_simplify_stroke?: boolean;
    contents_only?: boolean;
    use_absolute_bounds?: boolean;
}
export interface Comment {
    id: string;
    uuid?: string;
    file_key: string;
    parent_id?: string;
    user: User;
    created_at: string;
    resolved_at?: string | null;
    message: string;
    client_meta?: ClientMeta;
    order_id?: string;
    reactions?: Reaction[];
}
export interface ClientMeta {
    x?: number;
    y?: number;
    node_id?: string;
    node_offset?: Vector;
}
export interface Reaction {
    user: User;
    emoji: string;
    created_at: string;
}
export interface CommentsResponse {
    comments: Comment[];
}
export interface PostCommentParams {
    message: string;
    comment_id?: string;
    client_meta?: ClientMeta;
}
export interface CommentReactionsResponse {
    reactions: Reaction[];
    pagination?: Pagination;
}
export interface Component {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
    documentationLinks?: DocumentationLink[];
    componentSetId?: string;
}
export interface ComponentSet {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
    documentationLinks?: DocumentationLink[];
}
export interface Style {
    key: string;
    name: string;
    description: string;
    remote?: boolean;
    styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}
export interface DocumentationLink {
    uri: string;
}
export interface ComponentResponse {
    error?: boolean;
    status?: number;
    meta: ComponentMeta;
}
export interface ComponentMeta {
    key: string;
    file_key: string;
    node_id: string;
    thumbnail_url?: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    containing_frame?: FrameInfo;
    user: User;
}
export interface FrameInfo {
    pageId?: string;
    pageName?: string;
    nodeId?: string;
    name?: string;
    backgroundColor?: string;
    containingStateGroup?: StateGroup;
}
export interface StateGroup {
    nodeId: string;
    name: string;
}
export interface ComponentsResponse {
    error?: boolean;
    status?: number;
    meta: {
        components: ComponentMeta[];
        cursor?: Record<string, number>;
    };
}
export interface ComponentSetResponse {
    error?: boolean;
    status?: number;
    meta: ComponentSetMeta;
}
export interface ComponentSetMeta {
    key: string;
    file_key: string;
    node_id: string;
    thumbnail_url?: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    containing_frame?: FrameInfo;
    user: User;
}
export interface ComponentSetsResponse {
    error?: boolean;
    status?: number;
    meta: {
        component_sets: ComponentSetMeta[];
        cursor?: Record<string, number>;
    };
}
export interface StyleResponse {
    error?: boolean;
    status?: number;
    meta: StyleMeta;
}
export interface StyleMeta {
    key: string;
    file_key: string;
    node_id: string;
    style_type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
    thumbnail_url?: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    sort_position?: string;
    user: User;
}
export interface StylesResponse {
    error?: boolean;
    status?: number;
    meta: {
        styles: StyleMeta[];
        cursor?: Record<string, number>;
    };
}
export interface Project {
    id: string;
    name: string;
}
export interface ProjectFilesResponse {
    name: string;
    files: ProjectFile[];
}
export interface ProjectFile {
    key: string;
    name: string;
    thumbnail_url?: string;
    last_modified: string;
    branches?: Branch[];
}
export interface TeamProjectsResponse {
    name: string;
    projects: Project[];
}
export type WebhookEventType = 'PING' | 'FILE_UPDATE' | 'FILE_DELETE' | 'FILE_VERSION_UPDATE' | 'FILE_COMMENT' | 'LIBRARY_PUBLISH';
export type WebhookStatus = 'ACTIVE' | 'PAUSED';
export interface Webhook {
    id: string;
    team_id?: string;
    event_type: WebhookEventType;
    client_id?: string;
    endpoint: string;
    passcode: string;
    status: WebhookStatus;
    description?: string;
    protocol_version?: string;
}
export interface WebhooksResponse {
    webhooks: Webhook[];
}
export interface WebhookRequestsResponse {
    requests: WebhookRequest[];
}
export interface WebhookRequest {
    id: string;
    webhook_id: string;
    team_id?: string;
    file_key?: string;
    event_type: WebhookEventType;
    endpoint: string;
    sent_at: string;
    response_code?: number;
    error_msg?: string;
}
export interface CreateWebhookParams {
    event_type: WebhookEventType;
    team_id?: string;
    endpoint: string;
    passcode: string;
    status?: WebhookStatus;
    description?: string;
}
export interface UpdateWebhookParams {
    event_type?: WebhookEventType;
    endpoint?: string;
    passcode?: string;
    status?: WebhookStatus;
    description?: string;
}
export interface Variable {
    id: string;
    name: string;
    key: string;
    variableCollectionId: string;
    resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';
    valuesByMode: Record<string, VariableValue>;
    remote?: boolean;
    description?: string;
    hiddenFromPublishing?: boolean;
    scopes?: VariableScope[];
    codeSyntax?: VariableCodeSyntax;
}
export type VariableValue = boolean | number | string | Color | VariableAlias;
export type VariableScope = 'ALL_SCOPES' | 'TEXT_CONTENT' | 'CORNER_RADIUS' | 'WIDTH_HEIGHT' | 'GAP' | 'ALL_FILLS' | 'FRAME_FILL' | 'SHAPE_FILL' | 'TEXT_FILL' | 'STROKE_COLOR' | 'STROKE_FLOAT' | 'EFFECT_FLOAT' | 'EFFECT_COLOR' | 'OPACITY' | 'FONT_FAMILY' | 'FONT_STYLE' | 'FONT_SIZE' | 'LINE_HEIGHT' | 'LETTER_SPACING' | 'PARAGRAPH_SPACING' | 'PARAGRAPH_INDENT';
export interface VariableCodeSyntax {
    WEB?: string;
    ANDROID?: string;
    iOS?: string;
}
export interface VariableCollection {
    id: string;
    name: string;
    key: string;
    modes: VariableMode[];
    defaultModeId: string;
    remote?: boolean;
    hiddenFromPublishing?: boolean;
    variableIds?: string[];
}
export interface VariableMode {
    modeId: string;
    name: string;
}
export interface LocalVariablesResponse {
    status: number;
    error: boolean;
    meta: {
        variables: Record<string, Variable>;
        variableCollections: Record<string, VariableCollection>;
    };
}
export interface PublishedVariablesResponse {
    status: number;
    error: boolean;
    meta: {
        variables: Record<string, Variable>;
        variableCollections: Record<string, VariableCollection>;
    };
}
export interface DevResource {
    id: string;
    name: string;
    url: string;
    file_key: string;
    node_id: string;
}
export interface DevResourcesResponse {
    dev_resources: DevResource[];
}
export interface CreateDevResourceParams {
    name: string;
    url: string;
    file_key: string;
    node_id: string;
}
export interface UpdateDevResourceParams {
    name?: string;
    url?: string;
}
export interface ActivityLogEvent {
    id: string;
    timestamp: string;
    actor: {
        id: string;
        name?: string;
        email?: string;
        type: 'USER' | 'PLUGIN' | 'SYSTEM';
    };
    context: {
        client_name?: string;
        ip_address?: string;
    };
    entity: {
        id: string;
        name?: string;
        type: string;
    };
    action: {
        type: string;
        details?: Record<string, unknown>;
    };
}
export interface ActivityLogsResponse {
    events: ActivityLogEvent[];
    cursor?: string;
}
export interface Pagination {
    before?: number;
    after?: number;
}
export interface PaginationParams {
    page_size?: number;
    after?: number;
    before?: number;
}
export interface FigmaErrorResponse {
    status: number;
    err: string;
    message?: string;
}
//# sourceMappingURL=types.d.ts.map